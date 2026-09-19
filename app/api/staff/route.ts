import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { query, queryOne } from '@/lib/db';
import { getCurrentSession, hashPassword, ensureAdminTables } from '@/lib/auth';
import { hasPermission, ALL_ROLES, AdminRole, canManageRole } from '@/lib/rbac';

export async function GET() {
  try {
    await ensureAdminTables();
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.activeRole, 'staff:view')) {
      return NextResponse.json(
        { ok: false, error: 'forbidden', message: 'Viewing staff requires staff:view permission' },
        { status: 403 }
      );
    }

    const staffMembers = await query(`
      SELECT
        id, email, name, role, avatar_url, phone, status,
        last_login_at, last_login_ip, created_at, updated_at
      FROM admin_users
      ORDER BY
        CASE role
          WHEN 'super_admin' THEN 1
          WHEN 'admin' THEN 2
          WHEN 'support_lead' THEN 3
          WHEN 'support_executive' THEN 4
          WHEN 'marketing' THEN 5
          WHEN 'developer' THEN 6
          WHEN 'analyst' THEN 7
          ELSE 8
        END,
        created_at ASC
    `);

    return NextResponse.json({
      ok: true,
      staff: staffMembers,
      currentUserRole: session.role,
      activeRole: session.activeRole,
    });
  } catch (err: any) {
    console.error('Error fetching staff members:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureAdminTables();
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    if (!hasPermission(session.activeRole, 'staff:manage')) {
      return NextResponse.json(
        { ok: false, error: 'forbidden', message: 'Staff creation requires staff:manage permission' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, name, role, password, phone } = body;

    if (!email || !name || !role || !password) {
      return NextResponse.json(
        { ok: false, error: 'missing_fields', message: 'Name, email, role, and password are required' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanRole = role as AdminRole;

    if (!ALL_ROLES.includes(cleanRole)) {
      return NextResponse.json(
        { ok: false, error: 'invalid_role', message: `Invalid role. Must be one of: ${ALL_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!canManageRole(session.role, cleanRole)) {
      return NextResponse.json(
        { ok: false, error: 'forbidden', message: `Your role (${session.role}) cannot assign ${cleanRole}` },
        { status: 403 }
      );
    }

    // Check if email already taken
    const existing = await queryOne('SELECT id FROM admin_users WHERE LOWER(email) = LOWER($1)', [cleanEmail]);
    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'email_exists', message: 'A staff member with this email address already exists' },
        { status: 409 }
      );
    }

    const newId = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();
    const { hash, salt } = hashPassword(password);

    await query(`
      INSERT INTO admin_users (
        id, email, name, role, password_hash, salt, phone, status, created_at, updated_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10)
    `, [
      newId,
      cleanEmail,
      name.trim(),
      cleanRole,
      hash,
      salt,
      phone?.trim() || null,
      'active',
      now,
      session.userId,
    ]);

    // Audit log
    await query(
      'INSERT INTO admin_audit_logs (id, actor, action, target_type, target_id, details, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        crypto.randomUUID(),
        session.email,
        'staff.create',
        'admin_user',
        newId,
        JSON.stringify({ email: cleanEmail, name, role: cleanRole }),
        now,
      ]
    );

    return NextResponse.json({
      ok: true,
      message: 'Staff member created successfully',
      staff: {
        id: newId,
        email: cleanEmail,
        name: name.trim(),
        role: cleanRole,
        phone: phone?.trim() || null,
        status: 'active',
        created_at: now,
      },
    });
  } catch (err: any) {
    console.error('Error creating staff member:', err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
