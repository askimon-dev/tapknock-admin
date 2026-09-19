import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { ROLE_DEFINITIONS, PERMISSION_DEFINITIONS } from '@/lib/rbac';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    }

    const roleDef = ROLE_DEFINITIONS[session.activeRole];

    return NextResponse.json({
      ok: true,
      user: {
        userId: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        activeRole: session.activeRole,
        isPreview: session.isPreview,
        permissions: session.permissions,
        roleDefinition: roleDef,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
