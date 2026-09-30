import { NextResponse } from 'next/server';
import { TAPKNOCK_API_BASE, ADMIN_SECRET } from '@/lib/tapknock-api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(`${TAPKNOCK_API_BASE}/api/admin/app-versions`, {
      headers: { 'x-admin-secret': ADMIN_SECRET },
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message, users: [] }, { status: 500 });
  }
}
