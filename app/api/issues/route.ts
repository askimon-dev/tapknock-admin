import { NextRequest, NextResponse } from 'next/server';
import { adminListIssues, adminCreateIssue } from '@/lib/tapknock-api';
import { requirePermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!(await requirePermission('issues:view'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const data = await adminListIssues({
      status: searchParams.get('status') || undefined,
      kind: searchParams.get('kind') || undefined,
      priority: searchParams.get('priority') || undefined,
      area: searchParams.get('area') || undefined,
      assigned_ai: searchParams.get('assigned_ai') || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
    });
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Failed to list issues:', err);
    return NextResponse.json({ error: err.message, issues: [], counts: {} }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await requirePermission('issues:manage');
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await req.json();
    const data = await adminCreateIssue({
      ...body,
      created_by: session.name || session.email || 'admin',
    });
    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
