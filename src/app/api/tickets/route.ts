import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/postgres';

type TicketStatus = 'open' | 'in-progress' | 'waiting' | 'resolved' | 'closed';

const normalizeStatus = (value: unknown): TicketStatus | null => {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const compact = raw.replace(/[\s_\-/]+/g, '');

  if (compact.includes('open') || compact.includes('ouvert')) return 'open';
  if (compact.includes('inprogress') || compact.includes('encours')) return 'in-progress';
  if (compact.includes('waiting') || compact.includes('pending') || compact.includes('enattente')) return 'waiting';
  if (compact.includes('resolu') || compact.includes('resolue') || compact.includes('resolved')) return 'resolved';
  if (compact.includes('closed') || compact.includes('ferme') || compact.includes('fermee')) return 'closed';

  return null;
};

// GET /api/tickets - liste tous les tickets depuis la base de données
export async function GET() {
  try {
    // La machine du demandeur est resolue via created_by, stocke au format
    // "Nom Prenom <login@domaine>" alors que equipment.assigned_to_user contient
    // le login seul. On extrait donc l'adresse entre chevrons (a defaut la valeur
    // brute), puis on compare aussi bien sur l'adresse complete que sur le login
    // qui la precede, afin de couvrir les deux conventions de saisie.
    // Le modele materiel vit dans la table annexe equipment_model : le compte
    // applicatif n'est pas proprietaire de equipment et ne peut donc pas y
    // ajouter de colonne.
    const result = await dbQuery(
      `SELECT t.id, t.title, t.description, t.priority, t.status, t.category,
              t.created_by, t.assigned_to, t.comments,
              t.created_at, t.updated_at,
              m.id            AS machine_id,
              m.name          AS machine_name,
              m.type          AS machine_type,
              m.model         AS machine_model,
              m.ip_address    AS machine_ip_address,
              m.serial_number AS machine_serial_number,
              m.status        AS machine_status
       FROM tickets t
       LEFT JOIN LATERAL (
         SELECT e.id, e.name, e.type, em.model, e.ip_address, e.serial_number, e.status
         FROM equipment e
         LEFT JOIN equipment_model em ON em.equipment_id = e.id
         CROSS JOIN LATERAL (
           SELECT LOWER(TRIM(COALESCE(SUBSTRING(t.created_by FROM '<([^>]+)>'), t.created_by))) AS requester
         ) k
         WHERE NULLIF(TRIM(e.assigned_to_user), '') IS NOT NULL
           AND NULLIF(k.requester, '') IS NOT NULL
           AND (
             LOWER(TRIM(e.assigned_to_user)) = k.requester
             OR LOWER(TRIM(e.assigned_to_user)) = SPLIT_PART(k.requester, '@', 1)
           )
         ORDER BY
           CASE WHEN e.status = 'in-service' THEN 0 ELSE 1 END,
           CASE WHEN e.type IN ('pc', 'laptop') THEN 0 ELSE 1 END,
           e.updated_at DESC
         LIMIT 1
       ) m ON TRUE
       ORDER BY
         CASE t.priority
           WHEN 'critical' THEN 1
           WHEN 'high'     THEN 2
           WHEN 'medium'   THEN 3
           WHEN 'low'      THEN 4
           ELSE 5
         END,
         t.created_at DESC`
    );

    const tickets = result.rows.map((row) => {
      const mappedStatus = normalizeStatus(row.status);
      return {
      id: row.id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: mappedStatus ?? row.status,
      category: row.category,
      createdBy: row.created_by,
      assignedTo: row.assigned_to,
      comments: Array.isArray(row.comments) ? row.comments : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      requesterMachine: row.machine_id
        ? {
            id: row.machine_id,
            name: row.machine_name,
            type: row.machine_type,
            model: row.machine_model || undefined,
            ipAddress: row.machine_ip_address || undefined,
            serialNumber: row.machine_serial_number || undefined,
            status: row.machine_status,
          }
        : undefined,
    }});

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error('Erreur GET /api/tickets:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST /api/tickets - créer un nouveau ticket
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, description, priority, status, category, createdBy, assignedTo } = body;

    if (!id || !title) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 });
    }

    await dbQuery(
      `INSERT INTO tickets (id, title, description, priority, status, category, created_by, assigned_to, comments, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, '[]'::jsonb, NOW(), NOW())`,
      [id, title, description || '', priority || 'medium', status || 'open', category || 'other', createdBy || '', assignedTo || null]
    );

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /api/tickets:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
