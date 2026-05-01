import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/postgres';

// GET /api/tickets - liste tous les tickets depuis la base de données
export async function GET() {
  try {
    const result = await dbQuery(
      `SELECT id, title, description, priority, status, category,
              created_by, assigned_to, comments,
              created_at, updated_at
       FROM tickets
       ORDER BY
         CASE priority
           WHEN 'critical' THEN 1
           WHEN 'high'     THEN 2
           WHEN 'medium'   THEN 3
           WHEN 'low'      THEN 4
           ELSE 5
         END,
         created_at DESC`
    );

    const tickets = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      category: row.category,
      createdBy: row.created_by,
      assignedTo: row.assigned_to,
      comments: Array.isArray(row.comments) ? row.comments : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

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
