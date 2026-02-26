import { NextResponse } from 'next/server';
import { dbHealthcheck } from '@/lib/postgres';

export async function GET() {
  try {
    const status = await dbHealthcheck();
    return NextResponse.json({ ok: true, db: status });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: 'PostgreSQL connection failed.',
        details: error?.message || 'Unknown error',
      },
      { status: 500 },
    );
  }
}
