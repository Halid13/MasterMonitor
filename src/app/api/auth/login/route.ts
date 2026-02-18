import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import ldap from 'ldapjs';
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
  value.replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');

const bindAsync = (client: ldap.Client, dn: string, password: string) =>
  new Promise<void>((resolve, reject) => {
    const dnStr = String(dn || '');
    const pwdStr = String(password || '');
    if (!dnStr || !pwdStr) {
      return reject(new Error('EMPTY_PASSWORD'));
    }
    client.bind(dnStr, pwdStr, (err) => (err ? reject(err) : resolve()));
  });

const unbindSafe = (client: ldap.Client) => {
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

const findGroupDns = (client: ldap.Client, baseDn: string, groupNames: string[]) =>
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
    client.search(baseDn, opts, (err, res) => {
      if (err) return reject(err);
      res.on('searchEntry', (entry) => {
        const dn = String(entry.objectName || entry.dn || '').trim();
        if (dn) dns.push(dn);
      });
      res.on('error', (e) => reject(e));
      res.on('end', () => resolve(Array.from(new Set(dns))));
    });
  });

const isUserInGroupChain = (
  client: ldap.Client,
  baseDn: string,
  userDn: string,
  groupDns: string[],
) =>
  new Promise<boolean>((resolve, reject) => {
    if (groupDns.length === 0) return resolve(false);
    const filters = groupDns
      .map((dn) => `(memberOf:1.2.840.113556.1.4.1941:=${escapeLDAP(dn)})`)
      .join('');
    const filter = `(&(distinguishedName=${escapeLDAP(userDn)})(|${filters}))`;
    const opts = {
      scope: 'sub' as const,
      filter,
      sizeLimit: 1,
      attributes: ['dn'],
    };

    let found = false;
    client.search(baseDn, opts, (err, res) => {
      if (err) return reject(err);
      res.on('searchEntry', () => {
        found = true;
      });
      res.on('error', (e) => reject(e));
      res.on('end', () => resolve(found));
    });
  });

const findUserDN = (client: ldap.Client, baseDn: string, identifier: string) =>
  new Promise<{ dn: string; displayName?: string; groups?: string[] }>((resolve, reject) => {
    const safe = escapeLDAP(identifier);
    const filter = LDAP_USER_FILTER
      ? `(&${LDAP_USER_FILTER}(|(sAMAccountName=${safe})(userPrincipalName=${safe})(mail=${safe})))`
      : `(|(sAMAccountName=${safe})(userPrincipalName=${safe})(mail=${safe}))`;

    const opts = {
      scope: 'sub' as const,
      filter,
      sizeLimit: 1,
      attributes: ['dn', 'cn', 'displayName', 'memberOf'],
    };

    client.search(baseDn, opts, (err, res) => {
      if (err) return reject(err);
      let foundDn = '';
      let displayName = '';
      let groups: string[] = [];

      res.on('searchEntry', (entry) => {
        foundDn = String(entry.objectName || '');
        displayName = entry.object?.displayName || entry.object?.cn || '';
        groups = Array.isArray(entry.object?.memberOf)
          ? entry.object.memberOf.map((g: any) => String(g))
          : (entry.object?.memberOf ? [String(entry.object.memberOf)] : []);
      });
      res.on('error', (e) => reject(e));
      res.on('end', () => {
        if (!foundDn) return reject(new Error('USER_NOT_FOUND'));
        resolve({ dn: foundDn, displayName, groups });
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
    const { dn, displayName, groups = [] } = await findUserDN(client, LDAP_BASE_DN, identifier);
    console.info(`[LDAP ${requestId}] User DN found: ${dn}`);

    // Déterminer le rôle
    const groupNames = groups.map((g) => normalizeGroupName(cnFromDn(g)));
    const groupsLower = groups.map((g) => normalizeGroupName(g));
    const adminGroups = (LDAP_ADMIN_GROUPS || '')
      .split(/[,;|]/)
      .map((g) => normalizeGroupName(g))
      .filter(Boolean);

    const adminGroupDns = await findGroupDns(client, LDAP_BASE_DN, adminGroups);
    const isAdminByChain = await isUserInGroupChain(client, LDAP_BASE_DN, dn, adminGroupDns);

    const isAdmin =
      isAdminByChain ||
      adminGroups.some((g) => groupNames.includes(g) || groupsLower.some((dnVal) => dnVal.includes(g))) ||
      groupNames.some((g) => g.includes('domain admins') || g.includes('administrateurs') || g.includes('administrators')) ||
      groupsLower.some((g) => g.includes('domain admins') || g.includes('administrateurs') || g.includes('administrators')) ||
      groupsLower.some((g) => g.includes('admin'));

    let role = 'user';
    if (isAdmin) role = 'admin';
    else if (groupsLower.some((g) => g.includes('manager'))) role = 'manager';
    else if (groupsLower.some((g) => g.includes('tech'))) role = 'technician';

    // Vérifier le mot de passe en se liant avec l'utilisateur
    console.info(`[LDAP ${requestId}] Bind user DN`);
    await bindAsync(client, dn, password);
    console.info(`[LDAP ${requestId}] Bind user OK`);

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
