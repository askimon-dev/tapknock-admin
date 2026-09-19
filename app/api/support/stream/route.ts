import { NextRequest } from 'next/server';
import { TAPKNOCK_API_BASE, ADMIN_SECRET } from '@/lib/tapknock-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = `${TAPKNOCK_API_BASE}/api/admin/support/stream`;
    const response = await fetch(url, {
      headers: {
        'X-Admin-Secret': ADMIN_SECRET,
        Accept: 'text/event-stream',
      },
      cache: 'no-store',
    });

    if (!response.ok || !response.body) {
      return new Response('Failed to connect to support stream', { status: 502 });
    }

    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err: any) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
