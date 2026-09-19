import { NextRequest, NextResponse } from 'next/server';
import { adminGetSupportTicket, adminUpdateSupportTicket } from '@/lib/tapknock-api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const data = await adminGetSupportTicket(params.id);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data = await adminUpdateSupportTicket(params.id, body);
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
