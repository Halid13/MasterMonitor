import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/postgres';

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

    const updates: string[] = [];
    const values: (string | null)[] = [];
    let idx = 1;

    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
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

    await dbQuery(
      `UPDATE tickets SET ${updates.join(', ')} WHERE id = $${idx}`,
      values
    );

    return NextResponse.json({ success: true });
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
