import { NextRequest, NextResponse } from 'next/server';
import {
  getDynamicMonitoringData,
  getRealtimeMonitoringData,
  getStaticMonitoringData,
  persistMonitoringSnapshot,
} from '@/lib/monitoring-db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const stats = await persistMonitoringSnapshot(body || {});
    return NextResponse.json({ ok: true, saved: stats });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to persist monitoring snapshot.',
        details: error?.message || 'Unknown error',
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const view = request.nextUrl.searchParams.get('view') || 'realtime';

  try {
    if (view === 'dynamic') {
      const data = await getDynamicMonitoringData();
      return NextResponse.json({ ok: true, ...data });
    }

    if (view === 'static') {
      const data = await getStaticMonitoringData();
      return NextResponse.json({ ok: true, ...data });
    }

    const data = await getRealtimeMonitoringData();
    return NextResponse.json({ ok: true, ...data });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to read monitoring data.',
        details: error?.message || 'Unknown error',
      },
      { status: 500 },
    );
  }
}
