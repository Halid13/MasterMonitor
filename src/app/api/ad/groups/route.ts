import { NextResponse } from 'next/server';
import ldap from 'ldapjs';

const {
  LDAP_URL,
  LDAP_BASE_DN,
  LDAP_BIND_DN,
  LDAP_BIND_PASSWORD,
} = process.env;

const bindAsync = (client: ldap.Client, dn: string, password: string) =>
  new Promise<void>((resolve, reject) => {
    const dnStr = String(dn || '');
    const pwdStr = String(password || '');
    if (!dnStr || !pwdStr) return reject(new Error('EMPTY_BIND'));
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
      client.search(LDAP_BASE_DN, opts, (err, res) => {
        if (err) return reject(err);

        res.on('searchEntry', (entry) => {
          const obj = entry.object || {};
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

        res.on('error', (e) => reject(e));
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