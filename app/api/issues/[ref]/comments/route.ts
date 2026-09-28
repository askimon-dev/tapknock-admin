import { NextRequest, NextResponse } from 'next/server';
import { adminAddIssueComment } from '@/lib/tapknock-api';
import { requirePermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { ref: string } }) {
  const session = await requirePermission('issues:manage');
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { body } = await req.json();
    const author = session.name || session.email || 'admin';
    return NextResponse.json(await adminAddIssueComment(params.ref, author, body), { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
