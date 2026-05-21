import { NextResponse } from 'next/server';
import { Client } from 'ldapts';
import { logger } from '@/services/logger';

const {
  LDAP_URL,
  LDAP_BASE_DN,
  LDAP_BIND_DN,
  LDAP_BIND_PASSWORD,
} = process.env;

const cnFromDn = (dn: string) => {
  const match = /CN=([^,]+)/i.exec(dn);
  return match ? match[1] : dn;
};

export async function GET() {
  if (!LDAP_URL || !LDAP_BASE_DN || !LDAP_BIND_DN || !LDAP_BIND_PASSWORD) {
    return NextResponse.json({ ok: false, error: 'Configuration LDAP manquante.' }, { status: 500 });
  }

  const client = new Client({ url: LDAP_URL, connectTimeout: 5000, tlsOptions: { rejectUnauthorized: false } });
  try {
    await client.bind(LDAP_BIND_DN, LDAP_BIND_PASSWORD);

    const { searchEntries } = await client.search(LDAP_BASE_DN, {
      scope: 'sub',
      filter: '(objectClass=group)',
      attributes: ['dn', 'cn', 'distinguishedName', 'description', 'member'],
    });

    const groups = searchEntries.map((entry) => {
      const dn = String(entry.dn || entry.distinguishedName || '');
      const cn = String(entry.cn || cnFromDn(dn) || '');
      const rawMember = entry.member;
      const member = Array.isArray(rawMember) ? rawMember : rawMember ? [rawMember] : [];
      return {
        id: cn || dn,
        name: cn || dn,
        dn,
        description: String(entry.description || ''),
        membersCount: member.length,
      };
    });

    logger.logSystem('AD Groups Sync', 'LDAP', 'info', { count: groups.length });
    return NextResponse.json({ ok: true, groups });
  } catch {
    logger.logSystem('AD Groups Sync Failed', 'LDAP', 'error');
    return NextResponse.json({ ok: false, error: 'Erreur LDAP.' }, { status: 500 });
  } finally {
    try { await client.unbind(); } catch { /* ignore */ }
  }
}
