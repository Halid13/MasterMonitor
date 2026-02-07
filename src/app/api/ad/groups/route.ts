import { NextResponse } from 'next/server';
import ldap from 'ldapjs';

const {
  LDAP_URL,
  LDAP_BASE_DN,
  LDAP_BIND_DN,
  LDAP_BIND_PASSWORD,
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

export async function GET() {
  if (!LDAP_URL || !LDAP_BASE_DN || !LDAP_BIND_DN || !LDAP_BIND_PASSWORD) {
    return NextResponse.json(
      { ok: false, error: 'Configuration LDAP manquante.' },
      { status: 500 },
    );
  }

  const client = ldap.createClient({ url: LDAP_URL });
  try {
    await bindAsync(client, LDAP_BIND_DN, LDAP_BIND_PASSWORD);

    const opts = {
      scope: 'sub' as const,
      filter: '(objectClass=group)',
      attributes: ['cn', 'distinguishedName', 'description', 'member'],
    };

    const groups: Array<{
      id: string;
      name: string;
      dn: string;
      description: string;
      membersCount: number;
    }> = [];

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
          const member = Array.isArray(obj.member) ? obj.member : (obj.member ? [obj.member] : []);
          const dn = String(obj.distinguishedName || '');
          const cn = String(obj.cn || cnFromDn(dn) || '');

          groups.push({
            id: cn || dn,
            name: cn || dn,
            dn,
            description: String(obj.description || ''),
            membersCount: member.length,
          });
        });

        res.on('error', (e: any) => reject(e));
        res.on('end', () => resolve());
      });
    });

    return NextResponse.json({ ok: true, groups });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Erreur LDAP.' },
      { status: 500 },
    );
  } finally {
    unbindSafe(client);
  }
}