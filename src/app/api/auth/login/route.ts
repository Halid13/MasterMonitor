import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Client } from 'ldapts';
import { captureSecurityEvents } from '@/services/securityEventCapture';
import { logger } from '@/services/logger';

const {
  LDAP_URL,
  LDAP_BASE_DN,
  LDAP_BIND_DN,
  LDAP_BIND_PASSWORD,
  LDAP_USER_FILTER,
  LDAP_ADMIN_GROUPS,
} = process.env;

const escapeLDAP = (value: string) =>
  value
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');

const cnFromDn = (dn: string) => {
  const match = /CN=([^,]+)/i.exec(dn);
  return match ? match[1] : dn;
};

const normalizeGroupName = (name: string) => String(name || '').trim().toLowerCase();

const decodeLdapEscapedDn = (dn: string) => {
  try {
    if (!dn.includes('\\')) return dn;
    return decodeURIComponent(dn.replace(/\\([0-9a-fA-F]{2})/g, '%$1'));
  } catch {
    return dn;
  }
};

const domainFromBaseDn = (baseDn: string) =>
  baseDn
    .split(',')
    .map((part) => part.trim())
    .filter((part) => /^dc=/i.test(part))
    .map((part) => part.slice(3))
    .join('.');

export async function POST(req: NextRequest) {
  console.log('[LOGIN] POST request received');

  if (!LDAP_URL || !LDAP_BASE_DN || !LDAP_BIND_DN || !LDAP_BIND_PASSWORD) {
    console.error('[LOGIN] Missing LDAP configuration');
    return NextResponse.json({ ok: false, error: 'Configuration LDAP manquante.' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const identifier = String(body?.identifier || '').trim();
  const passwordRaw = body?.password;
  const password = String(passwordRaw ?? '');

  console.log(`[LOGIN] Attempt with identifier: ${identifier}`);

  if (!identifier || !password) {
    return NextResponse.json({ ok: false, error: 'Identifiants requis.' }, { status: 400 });
  }

  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ipSource =
    req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '0.0.0.0';

  const client = new Client({
    url: LDAP_URL,
    connectTimeout: 5000,
    // tlsOptions uniquement pour ldaps://, pas pour ldap:// (STARTTLS non supporté par cet AD)
    ...(LDAP_URL.startsWith('ldaps://') ? { tlsOptions: { rejectUnauthorized: false } } : {}),
  });

  try {
    // 1. Bind with service account
    console.info(`[LDAP ${requestId}] Bind service account: ${LDAP_BIND_DN}`);
    await client.bind(LDAP_BIND_DN, LDAP_BIND_PASSWORD);
    console.info(`[LDAP ${requestId}] Bind service account OK`);

    // 2. Search for user
    // Also try the local part (e.g. "Administrateur" from "Administrateur@monitor.local")
    // because the built-in AD admin may not have userPrincipalName set
    const safe = escapeLDAP(identifier);
    const localPart = identifier.includes('@') ? escapeLDAP(identifier.split('@')[0]) : null;
    const samFilters = localPart
      ? `(sAMAccountName=${safe})(sAMAccountName=${localPart})`
      : `(sAMAccountName=${safe})`;
    const baseFilter = `(|${samFilters}(userPrincipalName=${safe})(mail=${safe}))`;
    const userFilter = LDAP_USER_FILTER
      ? `(&${LDAP_USER_FILTER}${baseFilter})`
      : baseFilter;

    console.info(`[LDAP ${requestId}] Search user: ${identifier} (localPart: ${localPart ?? 'none'})`);
    const { searchEntries } = await client.search(LDAP_BASE_DN, {
      scope: 'sub',
      filter: userFilter,
      sizeLimit: 1,
      attributes: ['dn', 'distinguishedName', 'cn', 'displayName', 'memberOf', 'sAMAccountName', 'userPrincipalName'],
    });

    if (!searchEntries.length) {
      console.info(`[LDAP ${requestId}] User not found: ${identifier}`);
      throw new Error('USER_NOT_FOUND');
    }

    const entry = searchEntries[0];
    const dn = String(entry.dn || '').trim();
    const decodedDn = decodeLdapEscapedDn(dn);
    const displayName = String(entry.displayName || entry.cn || '');
    const sAMAccountName = String(entry.sAMAccountName || '');
    const userPrincipalName = String(entry.userPrincipalName || '');
    const rawMemberOf = entry.memberOf;
    let groups: string[] = Array.isArray(rawMemberOf)
      ? rawMemberOf.map((g) => String(g))
      : rawMemberOf
      ? [String(rawMemberOf)]
      : [];

    console.info(`[LDAP ${requestId}] User DN found: ${dn}`);
    console.info(`[LDAP ${requestId}] Groups count (direct memberOf): ${groups.length}`);

    // 3. If no memberOf, search groups by member attribute
    if (groups.length === 0) {
      console.info(`[LDAP ${requestId}] memberOf empty, searching groups by member attribute`);
      const dnCandidates = Array.from(new Set([dn, decodedDn].filter(Boolean)));
      const memberFilters = dnCandidates.map((d) => `(member=${escapeLDAP(d)})`).join('');
      const transitiveFilters = dnCandidates
        .map((d) => `(member:1.2.840.113556.1.4.1941:=${escapeLDAP(d)})`)
        .join('');
      try {
        const { searchEntries: groupEntries } = await client.search(LDAP_BASE_DN, {
          scope: 'sub',
          filter: `(&(objectClass=group)(|${memberFilters}${transitiveFilters}))`,
          attributes: ['dn'],
        });
        groups = groupEntries.map((g) => String(g.dn || '').trim()).filter(Boolean);
        console.info(`[LDAP ${requestId}] Groups found by search: ${groups.length}`);
      } catch (groupErr) {
        console.info(
          `[LDAP ${requestId}] Group search skipped: ${groupErr instanceof Error ? groupErr.message : groupErr}`,
        );
      }
    }

    if (groups.length > 0) {
      console.info(
        `[LDAP ${requestId}] Groups: ${groups.slice(0, 3).join(', ')}${groups.length > 3 ? '...' : ''}`,
      );
    }

    // 4. Determine role
    const adminGroups = (LDAP_ADMIN_GROUPS || '')
      .split(/[,;|]/)
      .map(normalizeGroupName)
      .filter(Boolean);

    const groupNames = groups.map((g) => normalizeGroupName(cnFromDn(g)));
    const groupsLower = groups.map((g) => normalizeGroupName(g));

    // Check admin via transitive group membership
    let isAdminByChain = false;
    if (adminGroups.length > 0) {
      try {
        const adminGroupFilters = adminGroups
          .map(
            (g) =>
              `(|(cn=${escapeLDAP(g)})(name=${escapeLDAP(g)})(displayName=${escapeLDAP(g)}))`,
          )
          .join('');
        const { searchEntries: adminGroupEntries } = await client.search(LDAP_BASE_DN, {
          scope: 'sub',
          filter: `(&(objectClass=group)(|${adminGroupFilters}))`,
          attributes: ['dn'],
        });
        const adminGroupDns = adminGroupEntries
          .map((e) => String(e.dn || '').trim())
          .filter(Boolean);

        if (adminGroupDns.length > 0) {
          const chainFilters = adminGroupDns
            .map((d) => `(memberOf:1.2.840.113556.1.4.1941:=${escapeLDAP(d)})`)
            .join('');
          const { searchEntries: chainEntries } = await client.search(dn, {
            scope: 'base',
            filter: `(|${chainFilters})`,
            sizeLimit: 1,
            attributes: ['dn'],
          });
          isAdminByChain = chainEntries.length > 0;
        }
      } catch (chainErr) {
        console.info(
          `[LDAP ${requestId}] Admin chain lookup skipped: ${chainErr instanceof Error ? chainErr.message : chainErr}`,
        );
      }
    }

    const isAdmin =
      isAdminByChain ||
      adminGroups.some((g) => groupNames.includes(g) || groupsLower.some((d) => d.includes(g))) ||
      groupNames.some(
        (g) =>
          g.includes('domain admins') ||
          g.includes('administrateurs') ||
          g.includes('administrators'),
      ) ||
      groupsLower.some(
        (g) =>
          g.includes('domain admins') ||
          g.includes('administrateurs') ||
          g.includes('administrators'),
      ) ||
      groupsLower.some((g) => g.includes('admin'));

    let role = 'user';
    if (isAdmin) role = 'admin';
    else if (groupsLower.some((g) => g.includes('manager'))) role = 'manager';
    else if (groupsLower.some((g) => g.includes('tech'))) role = 'technician';

    console.info(`[LDAP ${requestId}] Role determined: ${role}`);

    // 5. Verify password by binding as user
    const fallbackUpn =
      sAMAccountName && LDAP_BASE_DN
        ? `${sAMAccountName}@${domainFromBaseDn(LDAP_BASE_DN)}`
        : '';
    const bindCandidates = Array.from(
      new Set([decodedDn, dn, userPrincipalName, identifier, fallbackUpn].filter(Boolean)),
    );

    let boundPrincipal = '';
    let lastBindErr: unknown = null;
    for (const candidate of bindCandidates) {
      try {
        console.info(`[LDAP ${requestId}] Bind user principal: "${candidate}"`);
        await client.bind(candidate, password);
        boundPrincipal = candidate;
        break;
      } catch (bindErr) {
        lastBindErr = bindErr;
        const msg = bindErr instanceof Error ? bindErr.message : 'BIND_FAILED';
        console.info(`[LDAP ${requestId}] Bind failed for "${candidate}": ${msg}`);
      }
    }

    if (!boundPrincipal) {
      throw lastBindErr instanceof Error ? lastBindErr : new Error('INVALID_CREDENTIALS');
    }
    console.info(`[LDAP ${requestId}] Bind user OK via: "${boundPrincipal}"`);

    if (role !== 'admin') {
      captureSecurityEvents.loginFailed(identifier, ipSource, 'ROLE_NOT_AUTHORIZED', {
        provider: 'ldap',
        requestId,
        role,
      });
      return NextResponse.json(
        { ok: false, error: 'Accès refusé : administrateur requis.' },
        { status: 403 },
      );
    }

    // 6. Build response with cookies (secure: false - HTTP internal network)
    const res = NextResponse.json({ ok: true, user: { dn, displayName, role } });
    const cookieBase = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: false,
      maxAge: 60 * 60 * 8,
      path: '/',
    };
    res.cookies.set('mm_auth', '1', cookieBase);
    res.cookies.set('mm_user', displayName || identifier, { ...cookieBase, httpOnly: false });
    res.cookies.set('mm_role', role, { ...cookieBase, httpOnly: false });

    captureSecurityEvents.loginSuccess(displayName || identifier, ipSource, {
      provider: 'ldap',
      role,
      requestId,
    });
    logger.logUser(
      'LOGIN',
      displayName || identifier,
      displayName || identifier,
      'info',
      ipSource,
      { provider: 'ldap', role, requestId },
    );
    console.log(`[LOGIN SUCCESS] User: ${displayName || identifier}, Role: ${role}, IP: ${ipSource}`);
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    console.error(`[LOGIN] Error: ${message}`);

    captureSecurityEvents.loginFailed(identifier, ipSource, message, {
      provider: 'ldap',
      requestId,
    });
    return NextResponse.json(
      {
        ok: false,
        error: 'Identifiants invalides ou accès refusé.',
        ...(process.env.NODE_ENV !== 'production' && { debug: message }),
      },
      { status: 401 },
    );
  } finally {
    try {
      await client.unbind();
    } catch {
      // ignore
    }
  }
}
