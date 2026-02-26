import { getRealtimeMonitoringData } from '@/lib/monitoring-db';

export async function GET(request: Request) {
  const encoder = new TextEncoder();
  let timer: NodeJS.Timeout | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      push('connected', { ok: true, ts: Date.now() });

      const emitSnapshot = async () => {
        if (closed) return;
        try {
          const data = await getRealtimeMonitoringData();
          push('snapshot', data);
        } catch (error: any) {
          push('error', { ok: false, error: error?.message || 'Failed to load realtime data' });
        }
      };

      await emitSnapshot();
      timer = setInterval(() => {
        void emitSnapshot();
      }, 3000);

      request.signal.addEventListener('abort', () => {
        closed = true;
        if (timer) clearInterval(timer);
        controller.close();
      });
    },
    cancel() {
      closed = true;
      if (timer) clearInterval(timer);
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
