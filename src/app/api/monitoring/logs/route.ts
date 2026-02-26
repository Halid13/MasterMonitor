import { NextRequest, NextResponse } from 'next/server';
import { getFilteredLogs } from '@/lib/monitoring-db';

export async function GET(request: NextRequest) {
  const mode = (request.nextUrl.searchParams.get('mode') || 'recent') as 'recent' | 'critical' | 'error' | 'security';
  const limit = Number(request.nextUrl.searchParams.get('limit') || 100);
  const offset = Number(request.nextUrl.searchParams.get('offset') || 0);

  try {
    const data = await getFilteredLogs({ mode, limit, offset });
    return NextResponse.json({
      ok: true,
      mode,
      ...data,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch filtered logs.',
        details: error?.message || 'Unknown error',
      },
      { status: 500 },
    );
  }
}
