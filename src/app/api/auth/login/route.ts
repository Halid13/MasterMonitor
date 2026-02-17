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
    const groupsLower = groups.map((g) => g.toLowerCase());
    let role = 'user';
    if (groupsLower.some((g) => g.includes('admin'))) role = 'admin';
    else if (groupsLower.some((g) => g.includes('manager'))) role = 'manager';
    else if (groupsLower.some((g) => g.includes('tech'))) role = 'technician';

    // Vérifier le mot de passe en se liant avec l'utilisateur
    console.info(`[LDAP ${requestId}] Bind user DN`);
    await bindAsync(client, dn, password);
    console.info(`[LDAP ${requestId}] Bind user OK`);

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
