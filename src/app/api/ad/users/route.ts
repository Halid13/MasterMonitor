import { NextResponse } from 'next/server';
import { Client } from 'ldapts';
import { logger } from '@/services/logger';

const {
  LDAP_URL,
  LDAP_BASE_DN,
  LDAP_BIND_DN,
  LDAP_BIND_PASSWORD,
  LDAP_USER_FILTER,
} = process.env;

const cnFromDn = (dn: string) => {
  const match = /CN=([^,]+)/i.exec(dn);
  return match ? match[1] : dn;
};

const roleFromGroups = (groups: string[]) => {
  const lower = groups.map((g) => g.toLowerCase());
  if (lower.some((g) => g.includes('admin'))) return 'admin';
  if (lower.some((g) => g.includes('manager'))) return 'manager';
  if (lower.some((g) => g.includes('tech'))) return 'technician';
  return 'user';
};

export async function GET(request: Request) {
  if (!LDAP_URL || !LDAP_BASE_DN || !LDAP_BIND_DN || !LDAP_BIND_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'Configuration LDAP manquante.' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const debug = searchParams.get('debug') === '1';

  const client = new Client({ url: LDAP_URL, connectTimeout: 5000, ...(LDAP_URL.startsWith('ldaps://') ? { tlsOptions: { rejectUnauthorized: false } } : {}) });
  try {
    await client.bind(LDAP_BIND_DN, LDAP_BIND_PASSWORD);

    const filter = LDAP_USER_FILTER || '(&(objectCategory=person)(objectClass=user))';
    const attrs = debug
      ? ['*', '+']
      : ['sAMAccountName', 'userPrincipalName', 'givenName', 'sn', 'mail', 'department',
         'physicalDeliveryOfficeName', 'memberOf', 'userAccountControl', 'displayName',
         'cn', 'name', 'proxyAddresses'];

    const { searchEntries } = await client.search(LDAP_BASE_DN, {
      scope: 'sub',
      filter,
      attributes: attrs,
    });

    const parseDisplayName = (value: string) => {
      if (!value) return { first: '', last: '' };
      if (value.includes(',')) {
        const [lastPart, firstPart] = value.split(',').map((p) => p.trim());
        return { first: firstPart || '', last: lastPart || '' };
      }
      const parts = value.split(' ').filter(Boolean);
      const [first = '', ...rest] = parts;
      return { first, last: rest.join(' ') };
    };

    const users = searchEntries.map((entry) => {
      const rawMemberOf = entry.memberOf;
      const memberOf = Array.isArray(rawMemberOf) ? rawMemberOf : rawMemberOf ? [String(rawMemberOf)] : [];
      const groups = memberOf.map((dn) => cnFromDn(String(dn)));
      const uac = Number(entry.userAccountControl || 0);
      const isActive = (uac & 2) === 0;

      const givenName = String(entry.givenName || '');
      const sn = String(entry.sn || '');
      const displayName = String(entry.displayName || entry.name || entry.cn || '').trim();
      const parsed = parseDisplayName(displayName);

      const rawProxy = entry.proxyAddresses;
      const proxyAddresses = Array.isArray(rawProxy) ? rawProxy : rawProxy ? [String(rawProxy)] : [];
      const smtp = proxyAddresses.find((addr) => String(addr).toLowerCase().startsWith('smtp:'));
      const proxyMail = smtp ? String(smtp).replace(/^smtp:/i, '') : '';

      const dn = String(entry.dn || '');
      return {
        id: String(entry.sAMAccountName || entry.userPrincipalName || entry.mail || dn || ''),
        username: String(entry.sAMAccountName || ''),
        email: String(entry.mail || proxyMail || entry.userPrincipalName || ''),
        firstName: givenName || parsed.first || '',
        lastName: sn || parsed.last || '',
        department: String(entry.physicalDeliveryOfficeName || entry.department || ''),
        groups,
        role: roleFromGroups(groups),
        isActive,
      };
    });

    const raw = debug
      ? searchEntries.map((entry) => ({ dn: entry.dn, object: entry }))
      : undefined;

    logger.logSystem('AD Users Sync', 'LDAP', 'info', { count: users.length });
    return NextResponse.json({ ok: true, users, raw });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    logger.logSystem('AD Users Sync Failed', 'LDAP', 'error', { message });
    return NextResponse.json({ ok: false, error: 'Erreur LDAP.' }, { status: 500 });
  } finally {
    try { await client.unbind(); } catch { /* ignore */ }
  }
}
