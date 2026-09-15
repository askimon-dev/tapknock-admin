import { NextRequest, NextResponse } from 'next/server';
import { getContainerLogs } from '@/lib/docker';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tail = Math.min(parseInt(searchParams.get('tail') || '80', 10), 300);
    const logs = await getContainerLogs('tapknock-staging', tail);
    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json({ error: 'failed_to_fetch_logs', message: err.message }, { status: 500 });
  }
}
