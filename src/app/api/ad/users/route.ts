import { NextResponse } from 'next/server';
import ldap from 'ldapjs';

const {
  LDAP_URL,
  LDAP_BASE_DN,
  LDAP_BIND_DN,
  LDAP_BIND_PASSWORD,
  LDAP_USER_FILTER,
} = process.env;

const bindAsync = (client: any, dn: string, password: string) =>
  new Promise<void>((resolve, reject) => {
    const dnStr = String(dn || '');
    const pwdStr = String(password || '');
    if (!dnStr || !pwdStr) return reject(new Error('EMPTY_BIND'));
    client.bind(dnStr, pwdStr, (err: any) => (err ? reject(err) : resolve()));
  });

const unbindSafe = (client: any) => {
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

const roleFromGroups = (groups: string[]) => {
  const lower = groups.map((g) => g.toLowerCase());
  if (lower.some((g) => g.includes('admin'))) return 'admin';
  if (lower.some((g) => g.includes('manager'))) return 'manager';
  if (lower.some((g) => g.includes('tech'))) return 'technician';
  return 'user';
};

export async function GET(request: Request) {
  if (!LDAP_URL || !LDAP_BASE_DN || !LDAP_BIND_DN || !LDAP_BIND_PASSWORD) {
    return NextResponse.json(
      { ok: false, error: 'Configuration LDAP manquante.' },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const debug = searchParams.get('debug') === '1';

  const client = ldap.createClient({ url: LDAP_URL });
  try {
    await bindAsync(client, LDAP_BIND_DN, LDAP_BIND_PASSWORD);

    const filter = LDAP_USER_FILTER || '(&(objectCategory=person)(objectClass=user))';
    const opts = {
      scope: 'sub' as const,
      filter,
      attributes: debug
        ? ['*', '+']
        : [
            'sAMAccountName',
            'userPrincipalName',
            'givenName',
            'sn',
            'mail',
            'department',
            'memberOf',
            'userAccountControl',
            'displayName',
            'cn',
            'name',
            'proxyAddresses',
          ],
    };

    const users: any[] = [];
    const raw: any[] = [];

    await new Promise<void>((resolve, reject) => {
      client.search(LDAP_BASE_DN, opts, (err: any, res: any) => {
        if (err) return reject(err);

        res.on('searchEntry', (entry: any) => {
          const buildObject = () => {
            const mapped: Record<string, any> = {};

            const applyAttrs = (attrs: any[], valueKey: 'vals' | 'values') => {
              attrs.forEach((attr: any) => {
                if (!attr?.type) return;
                const vals = attr[valueKey];
                mapped[attr.type] = Array.isArray(vals) && vals.length === 1
                  ? vals[0]
                  : (vals ?? []);
              });
            };

            if (Array.isArray(entry?.attributes)) {
              applyAttrs(entry.attributes, 'vals');
            }

            if (Array.isArray(entry?.object?.attributes)) {
              applyAttrs(entry.object.attributes, 'values');
            }

            if (entry?.pojo && Object.keys(entry.pojo).length > 0) {
              Object.assign(mapped, entry.pojo);
            }

            if (entry?.object && Object.keys(entry.object).length > 0) {
              Object.assign(mapped, entry.object);
            }

            if (entry?.dn) mapped.distinguishedName = String(entry.dn);
            return mapped;
          };

          const obj = buildObject();
          const memberOf = Array.isArray(obj.memberOf)
            ? obj.memberOf
            : (obj.memberOf ? [obj.memberOf] : []);
          const groups = memberOf.map((dn: string) => cnFromDn(String(dn)));
          const uac = Number(obj.userAccountControl || 0);
          const isActive = (uac & 2) === 0;

          const givenName = String(obj.givenName || '');
          const sn = String(obj.sn || '');
          const displayName = String(obj.displayName || obj.name || obj.cn || '').trim();

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

          const parsed = parseDisplayName(displayName);

          const proxyAddresses = Array.isArray(obj.proxyAddresses)
            ? obj.proxyAddresses
            : (obj.proxyAddresses ? [obj.proxyAddresses] : []);
          const smtp = proxyAddresses.find((addr: string) => addr.toLowerCase().startsWith('smtp:'));
          const proxyMail = smtp ? String(smtp).replace(/^smtp:/i, '') : '';

          users.push({
            id: String(obj.sAMAccountName || obj.userPrincipalName || obj.mail || obj.distinguishedName || ''),
            username: String(obj.sAMAccountName || ''),
            email: String(obj.mail || proxyMail || obj.userPrincipalName || ''),
            firstName: givenName || parsed.first || '',
            lastName: sn || parsed.last || '',
            department: String(obj.department || ''),
            groups,
            role: roleFromGroups(groups),
            isActive,
          });

          if (debug) {
            raw.push({
              dn: entry?.dn ? String(entry.dn) : undefined,
              object: obj,
              attributes: Array.isArray(entry?.attributes)
                ? entry.attributes.map((attr: any) => ({ type: attr.type, vals: attr.vals }))
                : [],
            });
          }
        });

        res.on('error', (e: any) => reject(e));
        res.on('end', () => resolve());
      });
    });

    return NextResponse.json({ ok: true, users, raw: debug ? raw : undefined });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Erreur LDAP.' },
      { status: 500 },
    );
  } finally {
    unbindSafe(client);
  }
}
