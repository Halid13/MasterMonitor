import { NextRequest } from 'next/server';
import { logger } from '@/services/logger';
import type { SystemLog, LogCategory, LogLevel } from '@/types';

const matchesFilters = (
  log: SystemLog,
  filters: {
    category?: LogCategory;
    level?: LogLevel;
    module?: string;
    username?: string;
    search?: string;
  },
) => {
  if (filters.category && log.category !== filters.category) return false;
  if (filters.level && log.level !== filters.level) return false;
  if (filters.module && !log.module.toLowerCase().includes(filters.module.toLowerCase())) return false;
  if (filters.username && !(log.username || '').toLowerCase().includes(filters.username.toLowerCase())) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const haystack = [
      log.action,
      log.objectImpacted,
      log.module,
      log.username || '',
    ]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filters = {
    category: (searchParams.get('category') || undefined) as LogCategory | undefined,
    level: (searchParams.get('level') || undefined) as LogLevel | undefined,
    module: searchParams.get('module') || undefined,
    username: searchParams.get('username') || undefined,
    search: searchParams.get('search') || undefined,
  };

  const encoder = new TextEncoder();
  let keepAliveTimer: NodeJS.Timeout | null = null;
  let closed = false;
  let unsubscribe: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: string) => controller.enqueue(encoder.encode(payload));

      send('event: connected\n');
      send('data: {"ok":true}\n\n');

      unsubscribe = logger.subscribe((log) => {
        if (closed) return;
        if (!matchesFilters(log, filters)) return;
        send(`event: log\n`);
        send(`data: ${JSON.stringify(log)}\n\n`);
      });

      keepAliveTimer = setInterval(() => {
        if (closed) return;
        send('event: ping\n');
        send(`data: ${Date.now()}\n\n`);
      }, 15000);

      request.signal.addEventListener('abort', () => {
        closed = true;
        if (keepAliveTimer) clearInterval(keepAliveTimer);
        if (unsubscribe) unsubscribe();
        controller.close();
      });
    },
    cancel() {
      closed = true;
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
