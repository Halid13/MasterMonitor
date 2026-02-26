import { NextResponse, NextRequest } from 'next/server';
import { SystemLog, LogCategory, LogLevel } from '@/types';
import { logger } from '@/services/logger';
import { dbQuery } from '@/lib/postgres';

const IPv4_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const IPv6_REGEX = /\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b/;

const normalizeIp = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const noMappedPrefix = trimmed.startsWith('::ffff:') ? trimmed.slice(7) : trimmed;
  if (noMappedPrefix === '::1' || noMappedPrefix === '127.0.0.1' || noMappedPrefix === 'localhost') {
    return undefined;
  }
  return noMappedPrefix;
};

const getClientIpFromHeaders = (request: NextRequest) => {
  const xForwardedFor = request.headers.get('x-forwarded-for');
  if (xForwardedFor) {
    const first = xForwardedFor.split(',')[0]?.trim();
    const normalized = normalizeIp(first);
    if (normalized) return normalized;
  }

  const xRealIp = normalizeIp(request.headers.get('x-real-ip'));
  if (xRealIp) return xRealIp;

  const cfConnectingIp = normalizeIp(request.headers.get('cf-connecting-ip'));
  if (cfConnectingIp) return cfConnectingIp;

  const trueClientIp = normalizeIp(request.headers.get('true-client-ip'));
  if (trueClientIp) return trueClientIp;

  return undefined;
};

const extractIpFromPayload = (objectImpacted?: string, details?: Record<string, any>) => {
  const directKeys = [
    details?.ip,
    details?.ipAddress,
    details?.sourceIp,
    details?.targetIp,
    details?.deviceIp,
  ];

  for (const candidate of directKeys) {
    const normalized = normalizeIp(typeof candidate === 'string' ? candidate : undefined);
    if (normalized) return normalized;
  }

  if (typeof objectImpacted === 'string') {
    const objectMatch = objectImpacted.match(IPv4_REGEX)?.[0];
    const objectIpv4 = normalizeIp(objectMatch);
    if (objectIpv4) return objectIpv4;
    const objectIpv6 = normalizeIp(objectImpacted.match(IPv6_REGEX)?.[0]);
    if (objectIpv6) return objectIpv6;
  }

  if (details) {
    const text = JSON.stringify(details);
    const detailMatch = text.match(IPv4_REGEX)?.[0];
    const detailIpv4 = normalizeIp(detailMatch);
    if (detailIpv4) return detailIpv4;
    const detailIpv6 = normalizeIp(text.match(IPv6_REGEX)?.[0]);
    if (detailIpv6) return detailIpv6;
  }

  return undefined;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category') || undefined;
  const level = searchParams.get('level') || undefined;
  const module = searchParams.get('module') || undefined;
  const username = searchParams.get('username') || undefined;
  const searchQuery = searchParams.get('search') || undefined;
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    const safeLimit = Math.max(1, Math.min(500, Number.isFinite(limit) ? limit : 100));
    const safeOffset = Math.max(0, Number.isFinite(offset) ? offset : 0);

    const where: string[] = [];
    const values: any[] = [];

    if (category) {
      values.push(category);
      where.push(`category = $${values.length}`);
    }
    if (level) {
      values.push(level);
      where.push(`level = $${values.length}`);
    }
    if (module) {
      values.push(`%${module}%`);
      where.push(`module ILIKE $${values.length}`);
    }
    if (username) {
      values.push(`%${username}%`);
      where.push(`COALESCE(username, '') ILIKE $${values.length}`);
    }
    if (searchQuery) {
      values.push(`%${searchQuery}%`);
      where.push(`(
        action ILIKE $${values.length}
        OR object_impacted ILIKE $${values.length}
        OR module ILIKE $${values.length}
      )`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await dbQuery<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM logs ${whereClause}`,
      values,
    );

    const listValues = [...values, safeLimit, safeOffset];
    const logsResult = await dbQuery(
      `
      SELECT id, timestamp, category, level, username, module, action, object_impacted,
             old_value, new_value, ip_source, details
      FROM logs
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${listValues.length - 1}
      OFFSET $${listValues.length}
      `,
      listValues,
    );

    const total = countResult.rows[0]?.total || 0;
    const paginated = logsResult.rows.map((log: any) => ({
      id: log.id,
      timestamp: log.timestamp,
      category: log.category,
      level: log.level,
      username: log.username,
      module: log.module,
      action: log.action,
      objectImpacted: log.object_impacted,
      oldValue: log.old_value,
      newValue: log.new_value,
      ipSource: log.ip_source,
      details: log.details,
    }));

    return NextResponse.json({
      ok: true,
      logs: paginated,
      total,
      page: Math.floor(safeOffset / safeLimit) + 1,
      pages: Math.ceil(total / safeLimit),
    });
  } catch {
    const filtered = logger.searchLogs({
      category: category as LogCategory,
      level: level as LogLevel,
      module,
      username,
      search: searchQuery,
    });

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit).map((log) => {
      if (log.ipSource) return log;
      const inferred = extractIpFromPayload(log.objectImpacted, log.details);
      if (!inferred) return log;
      return {
        ...log,
        ipSource: inferred,
      };
    });

    return NextResponse.json({
      ok: true,
      logs: paginated,
      total,
      page: Math.floor(offset / limit) + 1,
      pages: Math.ceil(total / limit),
      source: 'memory-fallback',
    });
  }
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

    const requestIp = getClientIpFromHeaders(request);
    const payloadIp = extractIpFromPayload(objectImpacted, details);
    const explicitIp = normalizeIp(ipSource);
    const resolvedIp = explicitIp || payloadIp || requestIp;

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
        log = logger.logUser(action, objectImpacted, username || 'system', level, resolvedIp, details);
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
        log = logger.logSecurity(action, objectImpacted, level, username, resolvedIp, details);
        break;
      default:
        return NextResponse.json(
          { ok: false, error: 'Invalid log category' },
          { status: 400 }
        );
    }

    if (resolvedIp) {
      log.ipSource = resolvedIp;
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
    try {
      await dbQuery('DELETE FROM logs');
    } catch {
      // keep memory clear as fallback
    }
    return NextResponse.json({ ok: true, message: 'All logs cleared' });
  }

  if (action === 'purge-old') {
    const days = parseInt(searchParams.get('days') || '30');
    const removed = logger.purgeLogs(days);
    try {
      await dbQuery(
        `DELETE FROM logs WHERE timestamp < NOW() - ($1::text || ' days')::interval`,
        [String(days)],
      );
    } catch {
      // keep memory purge as fallback
    }
    return NextResponse.json({
      ok: true,
      message: `Purged ${removed} old logs (> ${days} days)`,
      removed,
    });
  }

  return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
}

