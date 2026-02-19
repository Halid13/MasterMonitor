import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import ldap from 'ldapjs';
import { captureSecurityEvents } from '@/services/securityEventCapture';
import { logger } from '@/services/logger';

type LdapClient = ReturnType<typeof ldap.createClient>;

const {
  LDAP_URL,
  LDAP_BASE_DN,
  LDAP_BIND_DN,
  LDAP_BIND_PASSWORD,
  LDAP_USER_FILTER,
  LDAP_ADMIN_GROUPS,
} = process.env;

const escapeLDAP = (value: string) =>
  value.replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');

const bindAsync = (client: LdapClient, dn: string, password: string) =>
  new Promise<void>((resolve, reject) => {
    const dnStr = String(dn || '');
    const pwdStr = String(password || '');
    if (!dnStr || !pwdStr) {
      return reject(new Error('EMPTY_PASSWORD'));
    }
    client.bind(dnStr, pwdStr, (err: any) => (err ? reject(err) : resolve()));
  });

const unbindSafe = (client: LdapClient) => {
  try {
    client.unbind();
  } catch {
    // ignore
  }
};

const cnFromDn = (dn: string) => {
  const match = /CN=([^,]+)/i.exec(dn);
  return match ? match[1] : dn;
};

const normalizeGroupName = (name: string) => name.trim().toLowerCase();

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

const bindUserWithFallback = async (
  client: LdapClient,
  password: string,
  candidates: string[],
  requestId: string,
) => {
  let lastError: unknown = null;
  const tried: string[] = [];

  for (const candidate of candidates) {
    const principal = String(candidate || '').trim();
    if (!principal || tried.includes(principal)) continue;
    tried.push(principal);
    try {
      console.info(`[LDAP ${requestId}] Bind user principal: "${principal}"`);
      await bindAsync(client, principal, password);
      return principal;
    } catch (error) {
      lastError = error;
      const msg = error instanceof Error ? error.message : 'BIND_FAILED';
      console.info(`[LDAP ${requestId}] Bind failed for principal "${principal}": ${msg}`);
    }
  }

  throw (lastError instanceof Error ? lastError : new Error('INVALID_CREDENTIALS'));
};

const findUserGroups = (client: LdapClient, baseDn: string, userDn: string) =>
  new Promise<string[]>((resolve, reject) => {
    const groupDns: string[] = [];
    const decodedDn = decodeLdapEscapedDn(userDn);
    const dnCandidates = Array.from(new Set([userDn, decodedDn].filter(Boolean)));
    const memberFilters = dnCandidates.map((dn) => `(member=${escapeLDAP(dn)})`).join('');
    const transitiveFilters = dnCandidates
      .map((dn) => `(member:1.2.840.113556.1.4.1941:=${escapeLDAP(dn)})`)
      .join('');
    const transitiveOpts = {
      scope: 'sub' as const,
      filter: `(&(objectClass=group)(|${memberFilters}${transitiveFilters}))`,
      attributes: ['dn', 'cn'],
    };

    client.search(baseDn, transitiveOpts, (err: any, res: any) => {
      if (err) {
        const code = String(err?.code ?? '');
        const msg = String(err?.message ?? '');
        if (code === '32' || /no such object/i.test(msg)) return resolve([]);
        return reject(err);
      }
      res.on('searchEntry', (entry: any) => {
        const groupDn = String(entry.objectName || entry.dn || '').trim();
        if (groupDn) groupDns.push(groupDn);
      });
      res.on('error', (e: any) => {
        const code = String(e?.code ?? '');
        const msg = String(e?.message ?? '');
        if (code === '32' || /no such object/i.test(msg)) return resolve(Array.from(new Set(groupDns)));
        return reject(e);
      });
      res.on('end', () => resolve(Array.from(new Set(groupDns))));
    });
  });

const findGroupDns = (client: LdapClient, baseDn: string, groupNames: string[]) =>
  new Promise<string[]>((resolve, reject) => {
    if (groupNames.length === 0) return resolve([]);
    const filters = groupNames
      .map((name) => {
        const safe = escapeLDAP(name);
        return `(|(cn=${safe})(name=${safe})(displayName=${safe}))`;
      })
      .join('');

    const filter = `(&(objectClass=group)(|${filters}))`;
    const opts = {
      scope: 'sub' as const,
      filter,
      attributes: ['dn'],
    };

    const dns: string[] = [];
    client.search(baseDn, opts, (err: any, res: any) => {
      if (err) return reject(err);
      res.on('searchEntry', (entry: any) => {
        const dn = String(entry.objectName || entry.dn || '').trim();
        if (dn) dns.push(dn);
      });
      res.on('error', (e: any) => reject(e));
      res.on('end', () => resolve(Array.from(new Set(dns))));
    });
  });

const isUserInGroupChain = (
  client: LdapClient,
  userDn: string,
  groupDns: string[],
) =>
  new Promise<boolean>((resolve, reject) => {
    if (groupDns.length === 0) return resolve(false);
    const filters = groupDns
      .map((dn) => `(memberOf:1.2.840.113556.1.4.1941:=${escapeLDAP(dn)})`)
      .join('');
    const filter = `(|${filters})`;
    const opts = {
      scope: 'base' as const,
      filter,
      sizeLimit: 1,
      attributes: ['dn'],
    };

    let found = false;
    client.search(userDn, opts, (err: any, res: any) => {
      if (err) {
        const code = String(err?.code ?? '');
        const msg = String(err?.message ?? '');
        if (code === '32' || /no such object/i.test(msg)) return resolve(false);
        return reject(err);
      }
      res.on('searchEntry', () => {
        found = true;
      });
      res.on('error', (e: any) => {
        const code = String(e?.code ?? '');
        const msg = String(e?.message ?? '');
        if (code === '32' || /no such object/i.test(msg)) return resolve(false);
        return reject(e);
      });
      res.on('end', () => resolve(found));
    });
  });

const findUserDN = (client: LdapClient, baseDn: string, identifier: string) =>
  new Promise<{
    dn: string;
    decodedDn: string;
    displayName?: string;
    groups?: string[];
    sAMAccountName?: string;
    userPrincipalName?: string;
  }>((resolve, reject) => {
    const safe = escapeLDAP(identifier);
    const filter = LDAP_USER_FILTER
      ? `(&${LDAP_USER_FILTER}(|(sAMAccountName=${safe})(userPrincipalName=${safe})(mail=${safe})))`
      : `(|(sAMAccountName=${safe})(userPrincipalName=${safe})(mail=${safe}))`;

    const opts = {
      scope: 'sub' as const,
      filter,
      sizeLimit: 1,
      attributes: ['dn', 'distinguishedName', 'cn', 'displayName', 'memberOf', 'sAMAccountName', 'userPrincipalName'],
    };

    client.search(baseDn, opts, (err: any, res: any) => {
      if (err) return reject(err);
      let foundDn = '';
      let decodedDn = '';
      let displayName = '';
      let sAMAccountName = '';
      let userPrincipalName = '';
      let groups: string[] = [];

      res.on('searchEntry', (entry: any) => {
        foundDn = String(entry.object?.distinguishedName || entry.objectName || '').trim();
        decodedDn = decodeLdapEscapedDn(foundDn);
        displayName = entry.object?.displayName || entry.object?.cn || '';
        sAMAccountName = entry.object?.sAMAccountName || '';
        userPrincipalName = entry.object?.userPrincipalName || '';
        groups = Array.isArray(entry.object?.memberOf)
          ? entry.object.memberOf.map((g: any) => String(g))
          : (entry.object?.memberOf ? [String(entry.object.memberOf)] : []);
        console.info(`[DEBUG] Raw memberOf: ${JSON.stringify(entry.object?.memberOf)}`);
        console.info(`[DEBUG] Parsed groups: ${JSON.stringify(groups)}`);
      });
      res.on('error', (e: any) => reject(e));
      res.on('end', () => {
        if (!foundDn) return reject(new Error('USER_NOT_FOUND'));
        resolve({ dn: foundDn, decodedDn: decodedDn || foundDn, displayName, groups, sAMAccountName, userPrincipalName });
      });
    });
  });

export async function POST(req: NextRequest) {
  console.log('[LOGIN] POST request received');
  
  if (!LDAP_URL || !LDAP_BASE_DN || !LDAP_BIND_DN || !LDAP_BIND_PASSWORD) {
    console.error('[LOGIN] Missing LDAP configuration');
    return NextResponse.json(
      { ok: false, error: 'Configuration LDAP manquante.' },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const identifier = String(body?.identifier || '').trim();
  const passwordRaw = body?.password;
  const password = String(passwordRaw ?? '');

  console.log(`[LOGIN] Attempt with identifier: ${identifier}`);

  if (!identifier || !password) {
    console.error('[LOGIN] Missing credentials');
    return NextResponse.json(
      { ok: false, error: 'Identifiants requis.' },
      { status: 400 },
    );
  }

  const client = ldap.createClient({ url: LDAP_URL });
  const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ipSource = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '0.0.0.0';

  console.info(`[LDAP ${requestId}] Connexion LDAP URL: ${LDAP_URL}`);
  console.info(`[LDAP ${requestId}] Base DN: ${LDAP_BASE_DN}`);
  console.info(
    `[LDAP ${requestId}] Password type: ${typeof passwordRaw}, length: ${password.length}`,
  );

  try {
    console.info(`[LDAP ${requestId}] Bind service account: ${LDAP_BIND_DN}`);
    await bindAsync(client, LDAP_BIND_DN, LDAP_BIND_PASSWORD);
    console.info(`[LDAP ${requestId}] Bind service account OK`);
    console.info(`[LDAP ${requestId}] Search user identifier: ${identifier}`);
    const {
      dn,
      decodedDn,
      displayName,
      groups = [],
      sAMAccountName = '',
      userPrincipalName = '',
    } = await findUserDN(client, LDAP_BASE_DN, identifier);
    console.info(`[LDAP ${requestId}] User DN found: ${dn}`);
    console.info(`[LDAP ${requestId}] Groups count (direct): ${groups.length}`);
    
    // Try alternative method to fetch groups if memberOf is empty
    let finalGroups = groups;
    if (groups.length === 0) {
      console.info(`[LDAP ${requestId}] memberOf empty, searching groups by member attribute`);
      const groupsByMember = await findUserGroups(client, LDAP_BASE_DN, dn);
      console.info(`[LDAP ${requestId}] Groups found by search: ${groupsByMember.length}`);
      finalGroups = groupsByMember;
    }
    
    if (finalGroups.length > 0) {
      console.info(`[LDAP ${requestId}] Groups: ${finalGroups.slice(0, 3).join(', ')}${finalGroups.length > 3 ? '...' : ''}`);
    }

    // Déterminer le rôle
    const adminGroups = (LDAP_ADMIN_GROUPS || '')
      .split(/[,;|]/)
      .map((g) => normalizeGroupName(g))
      .filter(Boolean);

    const adminGroupDns = await findGroupDns(client, LDAP_BASE_DN, adminGroups);
    let isAdminByChain = false;
    try {
      isAdminByChain = await isUserInGroupChain(client, dn, adminGroupDns);
    } catch (chainError) {
      const msg = chainError instanceof Error ? chainError.message : 'CHAIN_CHECK_FAILED';
      console.info(`[LDAP ${requestId}] Admin chain lookup skipped: ${msg}`);
      isAdminByChain = false;
    }

    const groupNamesFromFinal = finalGroups.map((g) => normalizeGroupName(cnFromDn(g)));
    const groupsLowerFromFinal = finalGroups.map((g) => normalizeGroupName(g));

    const isAdmin =
      isAdminByChain ||
      adminGroups.some((g) => groupNamesFromFinal.includes(g) || groupsLowerFromFinal.some((dnVal) => dnVal.includes(g))) ||
      groupNamesFromFinal.some((g) => g.includes('domain admins') || g.includes('administrateurs') || g.includes('administrators')) ||
      groupsLowerFromFinal.some((g) => g.includes('domain admins') || g.includes('administrateurs') || g.includes('administrators')) ||
      groupsLowerFromFinal.some((g) => g.includes('admin'));

    console.info(`[LDAP ${requestId}] Role determined: ${isAdmin ? 'admin' : 'user'}`);

    let role = 'user';
    if (isAdmin) role = 'admin';
    else if (groupsLowerFromFinal.some((g) => g.includes('manager'))) role = 'manager';
    else if (groupsLowerFromFinal.some((g) => g.includes('tech'))) role = 'technician';

    // Vérifier le mot de passe en se liant avec l'utilisateur (fallback DN/UPN)
    const fallbackUpn = sAMAccountName && LDAP_BASE_DN
      ? `${sAMAccountName}@${domainFromBaseDn(LDAP_BASE_DN)}`
      : '';
    const bindCandidates = [decodedDn, dn, userPrincipalName, identifier, fallbackUpn];

    console.info(`[LDAP ${requestId}] Bind user DN: "${dn}"`);
    console.info(`[LDAP ${requestId}] Password length: ${password.length}`);
    const boundPrincipal = await bindUserWithFallback(client, password, bindCandidates, requestId);
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

    const res = NextResponse.json({ ok: true, user: { dn, displayName, role } });
    res.cookies.set('mm_auth', '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 8,
      path: '/',
    });
    res.cookies.set('mm_user', displayName || identifier, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 8,
      path: '/',
    });
    res.cookies.set('mm_role', role, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 8,
      path: '/',
    });

    captureSecurityEvents.loginSuccess(displayName || identifier, ipSource, {
      provider: 'ldap',
      role,
      requestId,
    });

    // Log pour tous les utilisateurs qui se connectent au dashboard
    logger.logUser('LOGIN', displayName || identifier, displayName || identifier, 'info', ipSource, {
      provider: 'ldap',
      role,
      requestId,
    });
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
      { ok: false, error: 'Identifiants invalides ou accès refusé.' },
      { status: 401 },
    );
  } finally {
    unbindSafe(client);
  }
}
