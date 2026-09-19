import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { query, queryOne } from '@/lib/db';
import { getCurrentSession } from '@/lib/auth';
import { hasPermission, ALL_ROLES, AdminRole, canManageRole } from '@/lib/rbac';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.activeRole, 'staff:view')) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const member = await queryOne(`
      SELECT id, email, name, role, avatar_url, phone, status, last_login_at, last_login_ip, created_at, updated_at
      FROM admin_users WHERE id = $1
    `, [params.id]);

    if (!member) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, staff: member });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.activeRole, 'staff:manage')) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const target = await queryOne('SELECT * FROM admin_users WHERE id = $1', [params.id]);
    if (!target) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    const body = await request.json();
    const { name, role, status, phone } = body;

    // Permissions check: Can actor manage the target's current role and new role?
    if (!canManageRole(session.role, target.role)) {
      return NextResponse.json(
        { ok: false, error: 'forbidden', message: `Cannot modify staff with role ${target.role}` },
        { status: 403 }
      );
    }

    if (role && role !== target.role) {
      if (!ALL_ROLES.includes(role as AdminRole)) {
        return NextResponse.json({ ok: false, error: 'invalid_role' }, { status: 400 });
      }
      if (!canManageRole(session.role, role as AdminRole)) {
        return NextResponse.json(
          { ok: false, error: 'forbidden', message: `Cannot assign role ${role}` },
          { status: 403 }
        );
      }
    }

    // Safety guard: Cannot suspend or change role of primary super admin
    if (target.email === 'admin@tapknock.com' && session.userId !== target.id) {
      if (status && status !== 'active') {
        return NextResponse.json(
          { ok: false, error: 'forbidden', message: 'Primary super admin account cannot be suspended' },
          { status: 403 }
        );
      }
    }

    const updatedName = name !== undefined ? name.trim() : target.name;
    const updatedRole = role !== undefined ? role : target.role;
    const updatedStatus = status !== undefined ? status : target.status;
    const updatedPhone = phone !== undefined ? phone : target.phone;
    const now = new Date().toISOString();

    await query(`
      UPDATE admin_users
      SET name = $1, role = $2, status = $3, phone = $4, updated_at = $5
      WHERE id = $6
    `, [updatedName, updatedRole, updatedStatus, updatedPhone, now, target.id]);

    // Audit log
    await query(
      'INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        crypto.randomUUID(),
        session.email,
        'staff.update',
        'admin_user',
        target.id,
        JSON.stringify({
          previous: { name: target.name, role: target.role, status: target.status },
          updated: { name: updatedName, role: updatedRole, status: updatedStatus },
        }),
        now,
      ]
    );

    return NextResponse.json({
      ok: true,
      message: 'Staff updated successfully',
      staff: {
        id: target.id,
        email: target.email,
        name: updatedName,
        role: updatedRole,
        status: updatedStatus,
        phone: updatedPhone,
        updated_at: now,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.activeRole, 'staff:manage')) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const target = await queryOne('SELECT * FROM admin_users WHERE id = $1', [params.id]);
    if (!target) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    // Safety checks
    if (target.id === session.userId) {
      return NextResponse.json({ ok: false, error: 'forbidden', message: 'You cannot delete your own account' }, { status: 403 });
    }

    if (target.email === 'admin@tapknock.com') {
      return NextResponse.json({ ok: false, error: 'forbidden', message: 'The primary system admin account cannot be deleted' }, { status: 403 });
    }

    if (!canManageRole(session.role, target.role)) {
      return NextResponse.json({ ok: false, error: 'forbidden', message: `Cannot delete staff with role ${target.role}` }, { status: 403 });
    }

    await query('DELETE FROM admin_users WHERE id = $1', [target.id]);

    const now = new Date().toISOString();
    await query(
      'INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        crypto.randomUUID(),
        session.email,
        'staff.delete',
        'admin_user',
        target.id,
        JSON.stringify({ email: target.email, name: target.name, role: target.role }),
        now,
      ]
    );

    return NextResponse.json({ ok: true, message: 'Staff member deleted' });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
