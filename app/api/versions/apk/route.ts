import { NextRequest, NextResponse } from 'next/server';
import { TAPKNOCK_API_BASE, ADMIN_SECRET } from '@/lib/tapknock-api';

export const dynamic = 'force-dynamic';
// A build is around 100 MB. Reading it into a string or a Buffer here would
// hold all of it in the panel's memory for the length of the upload, so the
// body is passed through as a stream and never assembled.
export const runtime = 'nodejs';
export const maxDuration = 300;

/** What is on the server right now — exactly one build, or none. */
export async function GET() {
  try {
    const res = await fetch(`${TAPKNOCK_API_BASE}/api/admin/releases/apk`, {
      headers: { 'x-admin-secret': ADMIN_SECRET },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, files: [] }, { status: 500 });
  }
}

/**
 * Hands the build through to the API, which is the only side holding the
 * secret. The browser never sees it, which is why this hop exists at all.
 */
export async function POST(req: NextRequest) {
  const filename = req.headers.get('x-filename') || 'tapknock.apk';
  if (!req.body) {
    return NextResponse.json({ error: 'No file was sent.' }, { status: 400 });
  }

  try {
    const res = await fetch(`${TAPKNOCK_API_BASE}/api/admin/releases/apk`, {
      method: 'POST',
      headers: {
        'content-type': 'application/vnd.android.package-archive',
        'x-admin-secret': ADMIN_SECRET,
        'x-filename': filename,
      },
      body: req.body,
      // Required by undici whenever a stream is used as a request body.
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
