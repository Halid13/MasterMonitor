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

// PATCH /api/tickets/[id] - mettre à jour un ticket
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { id } = params;
    const body = await request.json();
    const { status, assignedTo, title, description, priority, category } = body;
    const normalizedStatus = status !== undefined ? normalizeStatus(status) : undefined;

    if (status !== undefined && !normalizedStatus) {
      return NextResponse.json({ error: 'Statut invalide' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: (string | null)[] = [];
    let idx = 1;

    if (normalizedStatus !== undefined) { updates.push(`status = $${idx++}`); values.push(normalizedStatus); }
    if (assignedTo !== undefined) { updates.push(`assigned_to = $${idx++}`); values.push(assignedTo); }
    if (title !== undefined) { updates.push(`title = $${idx++}`); values.push(title); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
    if (priority !== undefined) { updates.push(`priority = $${idx++}`); values.push(priority); }
    if (category !== undefined) { updates.push(`category = $${idx++}`); values.push(category); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Aucune mise à jour fournie' }, { status: 400 });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const result = await dbQuery(
      `UPDATE tickets
       SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING id, status, assigned_to, updated_at`,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Ticket introuvable' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ticket: result.rows[0] });
  } catch (error) {
    console.error('Erreur PATCH /api/tickets/[id]:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE /api/tickets/[id] - supprimer un ticket
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    await dbQuery('DELETE FROM tickets WHERE id = $1', [params.id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE /api/tickets/[id]:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
