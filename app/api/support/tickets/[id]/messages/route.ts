import { NextRequest, NextResponse } from 'next/server';
import { adminSendSupportMessage } from '@/lib/tapknock-api';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data = await adminSendSupportMessage(params.id, body);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
