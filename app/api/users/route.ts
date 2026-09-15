import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { calculateAge, getAgeCohort, getGeneration, parseDobToDate } from '@/lib/demographics';

function normalizeCohort(s: string) {
  return s.replace(/\s+/g, '').replace(/[–—]/g, '-').toLowerCase();
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const ageGroup = searchParams.get('age_group') || '';

    let sql = `
      SELECT a.*,
        (SELECT count(*) FROM doors d WHERE d.owner_id = a.id) as door_count,
        (SELECT count(*) FROM rings r JOIN doors d ON d.id = r.door_id WHERE d.owner_id = a.id) as ring_count,
        (SELECT count(*) FROM sessions s WHERE s.account_id = a.id AND s.expires_at > $1) as active_sessions_count
      FROM accounts a
      WHERE a.deleted_at IS NULL
    `;
    const params: any[] = [new Date().toISOString()];

    if (q) {
      sql += ` AND (LOWER(a.email) LIKE $2 OR LOWER(a.display_name) LIKE $2 OR a.id LIKE $2)`;
      params.push(`%${q.toLowerCase()}%`);
    }

    sql += ` ORDER BY a.created_at DESC`;

    const rawAccounts = await query<any>(sql, params);
    const accounts = (rawAccounts || []).map((acc) => {
      const age = calculateAge(acc.dob);
      const birthDate = parseDobToDate(acc.dob);
      const age_group = getAgeCohort(age);
      const generation = getGeneration(birthDate);

      return {
        ...acc,
        age,
        age_group,
        generation,
      };
    });

    const filteredAccounts = ageGroup && ageGroup.toLowerCase() !== 'all'
      ? accounts.filter((a) => normalizeCohort(a.age_group || 'unspecified') === normalizeCohort(ageGroup))
      : accounts;

    return NextResponse.json({ accounts: filteredAccounts });
  } catch (err: any) {
    return NextResponse.json({ error: 'users_fetch_error', message: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action') || 'revoke_sessions';

    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

    if (action === 'revoke_sessions') {
      await query('DELETE FROM sessions WHERE account_id = $1', [id]);
      return NextResponse.json({ ok: true, message: 'Active sessions revoked' });
    }

    if (action === 'delete_account') {
      await query(
        `UPDATE accounts
         SET deleted_at = $1, email = NULL, display_name = NULL, photo_path = NULL,
             address_line = NULL, address_area = NULL, postcode = NULL, state = NULL
         WHERE id = $2`,
        [new Date().toISOString(), id]
      );
      await query('DELETE FROM sessions WHERE account_id = $1', [id]);
      return NextResponse.json({ ok: true, message: 'Account deleted' });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: 'users_action_error', message: err.message }, { status: 500 });
  }
}
