import { NextResponse, NextRequest } from 'next/server';
import { SystemLog, LogCategory, LogLevel } from '@/types';
import { logger } from '@/services/logger';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category') || undefined;
  const level = searchParams.get('level') || undefined;
  const module = searchParams.get('module') || undefined;
  const username = searchParams.get('username') || undefined;
  const searchQuery = searchParams.get('search') || undefined;
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  // Use the real logger to search logs
  const filtered = logger.searchLogs({
    category: category as LogCategory,
    level: level as LogLevel,
    module,
    username,
    search: searchQuery,
  });

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  return NextResponse.json({
    ok: true,
    logs: paginated,
    total,
    page: Math.floor(offset / limit) + 1,
    pages: Math.ceil(total / limit),
  });
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      category,
      level,
      username,
      module,
      action,
      objectImpacted,
      oldValue,
      newValue,
      ipSource,
      details,
    } = body;

    if (!category || !level || !module || !action || !objectImpacted) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Use the real logger based on category
    let log: SystemLog;
    
    switch (category) {
      case 'system':
        log = logger.logSystem(action, objectImpacted, level, details, oldValue, newValue);
        break;
      case 'user':
        log = logger.logUser(action, objectImpacted, username || 'system', level, ipSource, details);
        break;
      case 'action':
        log = logger.logAction(
          action as any,
          module,
          objectImpacted,
          username,
          level,
          oldValue,
          newValue,
          details
        );
        break;
      case 'security':
        log = logger.logSecurity(action, objectImpacted, level, username, ipSource, details);
        break;
      default:
        return NextResponse.json(
          { ok: false, error: 'Invalid log category' },
          { status: 400 }
        );
    }

    return NextResponse.json({ ok: true, log });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message || 'Failed to create log' },
      { status: 500 }
    );
  }
}


export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');

  if (action === 'clear') {
    logger.clearLogs();
    return NextResponse.json({ ok: true, message: 'All logs cleared' });
  }

  if (action === 'purge-old') {
    const days = parseInt(searchParams.get('days') || '30');
    const removed = logger.purgeLogs(days);
    return NextResponse.json({
      ok: true,
      message: `Purged ${removed} old logs (> ${days} days)`,
      removed,
    });
  }

  return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
}

