import { NextRequest, NextResponse } from 'next/server';
import { adminGetIssue, adminUpdateIssue, adminDeleteIssue } from '@/lib/tapknock-api';
import { requirePermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { ref: string } }) {
  if (!(await requirePermission('issues:view'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    return NextResponse.json(await adminGetIssue(params.ref));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { ref: string } }) {
  const session = await requirePermission('issues:manage');
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await req.json();
    // Who moved it, so the trail the server writes names a person.
    return NextResponse.json(
      await adminUpdateIssue(params.ref, { ...body, actor: session.name || session.email || 'admin' })
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { ref: string } }) {
  if (!(await requirePermission('issues:manage'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    return NextResponse.json(await adminDeleteIssue(params.ref));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
