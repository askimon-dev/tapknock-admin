import { NextResponse } from 'next/server';
import { triggerTestRing } from '@/lib/tapknock-api';

export async function POST(request: Request) {
  try {
    const { code, visitor_name } = await request.json();
    if (!code) return NextResponse.json({ error: 'code_required' }, { status: 400 });

    const result = await triggerTestRing(code, visitor_name || 'Admin Console Test Ring');
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: 'test_ring_failed', message: err.message }, { status: 500 });
  }
}
