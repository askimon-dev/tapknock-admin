import { NextRequest } from 'next/server';
import { TAPKNOCK_API_BASE, ADMIN_SECRET } from '@/lib/tapknock-api';

export const dynamic = 'force-dynamic';
// Explicit, because the edge runtime cannot hold a long-lived upstream body and
// this route's whole job is to hold one.
export const runtime = 'nodejs';
// A stream that the platform is allowed to time out after the default is a
// stream that drops every few minutes and a client that reconnects for ever.
export const maxDuration = 3600;

export async function GET(req: NextRequest) {
  try {
    const url = `${TAPKNOCK_API_BASE}/api/admin/support/stream`;
    const response = await fetch(url, {
      headers: {
        'X-Admin-Secret': ADMIN_SECRET,
        Accept: 'text/event-stream',
      },
      cache: 'no-store',
      // undici gives up on a body that goes quiet, and a doorbell console can
      // be quiet for hours. The upstream sends a ping every twenty seconds, so
      // silence longer than this is a dead connection rather than a calm one.
      // @ts-expect-error -- undici option, not in the DOM fetch types
      bodyTimeout: 0,
      headersTimeout: 30_000,
    });

    if (!response.ok || !response.body) {
      return new Response('Failed to connect to support stream', { status: 502 });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        // Without this a reverse proxy may sit on the stream waiting for a
        // buffer to fill, which for an event stream never happens.
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
