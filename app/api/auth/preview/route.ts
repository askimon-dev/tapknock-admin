import { NextResponse } from 'next/server';
import { getCurrentSession, createSessionToken, ADMIN_COOKIE_NAME } from '@/lib/auth';
import { AdminRole, ALL_ROLES } from '@/lib/rbac';

export async function POST(request: Request) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });
    }

    // Only genuine super_admin can use preview mode
    if (session.role !== 'super_admin') {
      return NextResponse.json(
        { ok: false, error: 'forbidden', message: 'Only super_admin can preview other roles' },
        { status: 403 }
      );
    }

    const { targetRole } = await request.json();

    let previewRole: AdminRole | null = null;
    if (targetRole && ALL_ROLES.includes(targetRole as AdminRole)) {
      previewRole = targetRole as AdminRole;
    }

    const newToken = createSessionToken(
      {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
      },
      previewRole
    );

    const response = NextResponse.json({
      ok: true,
      message: previewRole ? `Now previewing as ${previewRole}` : 'Exited preview mode',
      activeRole: previewRole || session.role,
      isPreview: !!previewRole && previewRole !== session.role,
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: newToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
