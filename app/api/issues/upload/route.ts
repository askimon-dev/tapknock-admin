import { NextRequest, NextResponse } from 'next/server';
import { TAPKNOCK_API_BASE, ADMIN_SECRET } from '@/lib/tapknock-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Passes a screenshot through to the API, which holds the secret. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${TAPKNOCK_API_BASE}/api/admin/issues/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-secret': ADMIN_SECRET },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: 'upload_failed', message: err?.message }, { status: 500 });
  }
}
