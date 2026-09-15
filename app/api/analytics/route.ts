import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { fetchLiveBackendStats } from '@/lib/tapknock-api';
import { computeDemographics } from '@/lib/demographics';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const todayIso = new Date().toISOString().slice(0, 10);

    // 1. Basic counts
    const accountsCount = (await queryOne<{ count: string }>('SELECT count(*) FROM accounts WHERE deleted_at IS NULL'))?.count ?? '0';
    const doorsCount = (await queryOne<{ count: string }>('SELECT count(*) FROM doors'))?.count ?? '0';
    const ringsCount = (await queryOne<{ count: string }>('SELECT count(*) FROM rings'))?.count ?? '0';
    const ringsTodayCount = (await queryOne<{ count: string }>('SELECT count(*) FROM rings WHERE created_at LIKE $1', [`${todayIso}%`]))?.count ?? '0';
    const notificationsCount = (await queryOne<{ count: string }>('SELECT count(*) FROM push_notifications'))?.count ?? '0';

    // 2. Answer rate
    const answeredCount = (await queryOne<{ count: string }>("SELECT count(*) FROM rings WHERE status = 'answered'"))?.count ?? '0';
    const totalRingsNum = parseInt(ringsCount, 10);
    const answeredNum = parseInt(answeredCount, 10);
    const answerRate = totalRingsNum > 0 ? Math.round((answeredNum / totalRingsNum) * 100) : 0;

    // 3. Outcomes breakdown
    const outcomes = await query<{ status: string; count: string }>(
      'SELECT status, count(*) FROM rings GROUP BY status ORDER BY count DESC'
    );
    const statusColors: Record<string, string> = {
      answered: '#10B981', // Emerald green
      ringing: '#3B82F6',  // Blue
      declined: '#EF4444', // Red
      missed: '#F59E0B',   // Amber
      quiet_hours: '#8B5CF6', // Purple
      blocked: '#6B7280',  // Gray
    };
    const outcomesBreakdown = outcomes.map((o) => ({
      name: o.status.replace('_', ' ').toUpperCase(),
      status: o.status,
      count: parseInt(o.count, 10),
      color: statusColors[o.status] || '#60A5FA',
    }));

    // 4. Ring activity (Last 7 days)
    const days: { date: string; rings: number; answered: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      days.push({ date: iso, rings: 0, answered: 0 });
    }

    const recentDailyRings = await query<{ day: string; status: string; count: string }>(
      `SELECT SUBSTRING(created_at, 1, 10) as day, status, count(*)
       FROM rings
       WHERE created_at >= $1
       GROUP BY SUBSTRING(created_at, 1, 10), status`,
      [days[0].date]
    );

    const ringMap: Record<string, { total: number; answered: number }> = {};
    for (const r of recentDailyRings) {
      if (!ringMap[r.day]) ringMap[r.day] = { total: 0, answered: 0 };
      const cnt = parseInt(r.count, 10);
      ringMap[r.day].total += cnt;
      if (r.status === 'answered') ringMap[r.day].answered += cnt;
    }

    const ringActivity = days.map((d) => ({
      date: d.date.slice(5), // MM-DD
      rings: ringMap[d.date]?.total ?? 0,
      answered: ringMap[d.date]?.answered ?? 0,
    }));

    // 5. Hourly activity (0-23 hours distribution)
    const hourlyRows = await query<{ hr: string; count: string }>(
      `SELECT SUBSTRING(created_at, 12, 2) as hr, count(*)
       FROM rings
       GROUP BY SUBSTRING(created_at, 12, 2)
       ORDER BY hr ASC`
    );
    const hourlyMap: Record<string, number> = {};
    for (const h of hourlyRows) {
      hourlyMap[h.hr] = parseInt(h.count, 10);
    }
    const hourlyActivity = Array.from({ length: 24 }, (_, i) => {
      const hrStr = i.toString().padStart(2, '0');
      return {
        hour: `${hrStr}:00`,
        count: hourlyMap[hrStr] || 0,
      };
    });

    // 6. Recent Rings
    const recentRings = await query<any>(
      `SELECT r.*, d.label as door_label, d.display_name as door_name
       FROM rings r
       LEFT JOIN doors d ON d.id = r.door_id
       ORDER BY r.created_at DESC LIMIT 8`
    );

    // 7. Recent notifications
    const recentNotifications = await query<any>(
      `SELECT * FROM push_notifications ORDER BY created_at DESC LIMIT 5`
    );

    // 8. Live backend stats
    const liveStats = await fetchLiveBackendStats();

    // 9. Age Group Demographics
    const accountsData = await query<any>(
      `SELECT 
         a.id, 
         a.dob,
         (SELECT count(*) FROM doors d WHERE d.owner_id = a.id) as door_count,
         (SELECT count(*) FROM rings r JOIN doors d ON d.id = r.door_id WHERE d.owner_id = a.id) as ring_count
       FROM accounts a
       WHERE a.deleted_at IS NULL`
    );
    const ageDemographics = computeDemographics(accountsData || []);

    return NextResponse.json({
      totalAccounts: parseInt(accountsCount, 10),
      totalDoors: parseInt(doorsCount, 10),
      totalRings: totalRingsNum,
      ringsToday: parseInt(ringsTodayCount, 10),
      answerRate,
      activeOnlineDevices: liveStats?.stats?.online_devices ?? 0,
      notificationsCount: parseInt(notificationsCount, 10),
      outcomesBreakdown,
      ringActivity,
      hourlyActivity,
      recentRings,
      recentNotifications,
      ageDemographics,
      liveStats: liveStats?.stats || null,
    });
  } catch (err: any) {
    console.error('Analytics API error:', err);
    return NextResponse.json({ error: 'analytics_error', message: err.message }, { status: 500 });
  }
}
