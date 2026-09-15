import { NextRequest, NextResponse } from 'next/server';
import { query, queryStaging } from '@/lib/db';

export const dynamic = 'force-dynamic';

function escapeCsvField(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: Record<string, any>[], columns: { key: string; label: string }[]): string {
  const header = columns.map((c) => escapeCsvField(c.label)).join(',');
  const body = rows.map((row) =>
    columns.map((col) => escapeCsvField(row[col.key])).join(',')
  ).join('\r\n');
  return '\uFEFF' + header + '\r\n' + body;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'rings';
    const source = searchParams.get('source') === 'staging' ? 'staging' : 'prod';
    const format = searchParams.get('format') === 'json' ? 'json' : 'csv';

    const dbQuery = source === 'staging' ? queryStaging : query;
    const nowIso = new Date().toISOString().slice(0, 10);

    // 1. DOORS EXPORT
    if (type === 'doors') {
      const doors = await dbQuery<any>(`
        SELECT 
          d.id,
          d.label,
          d.display_name,
          d.address_line,
          d.lat,
          d.lng,
          d.radius_m,
          d.standing_note,
          d.auto_reply,
          d.quiet_start,
          d.quiet_end,
          d.ring_seconds,
          d.is_active,
          d.created_at,
          a.email as owner_email,
          a.display_name as owner_name,
          c.public_code,
          (SELECT count(*) FROM rings r WHERE r.door_id = d.id) as total_rings,
          (SELECT count(*) FROM rings r WHERE r.door_id = d.id AND r.status = 'answered') as answered_rings,
          (SELECT count(*) FROM rings r WHERE r.door_id = d.id AND r.status = 'missed') as missed_rings,
          (SELECT count(*) FROM rings r WHERE r.door_id = d.id AND r.status = 'declined') as declined_rings
        FROM doors d
        LEFT JOIN accounts a ON a.id = d.owner_id
        LEFT JOIN codes c ON c.door_id = d.id AND c.revoked_at IS NULL
        ORDER BY d.created_at DESC
      `);

      if (format === 'json') {
        return NextResponse.json({ source, type, count: doors.length, data: doors });
      }

      const columns = [
        { key: 'id', label: 'Door ID' },
        { key: 'public_code', label: 'Public QR Code' },
        { key: 'display_name', label: 'Display Name' },
        { key: 'label', label: 'Label' },
        { key: 'owner_name', label: 'Owner Name' },
        { key: 'owner_email', label: 'Owner Email' },
        { key: 'address_line', label: 'Address' },
        { key: 'lat', label: 'Latitude' },
        { key: 'lng', label: 'Longitude' },
        { key: 'radius_m', label: 'Geofence Radius (m)' },
        { key: 'ring_seconds', label: 'Ring Duration (s)' },
        { key: 'is_active', label: 'Active Status (1=Active, 0=Paused)' },
        { key: 'auto_reply', label: 'Auto-Reply Note' },
        { key: 'standing_note', label: 'Standing Delivery Note' },
        { key: 'quiet_start', label: 'Quiet Hours Start' },
        { key: 'quiet_end', label: 'Quiet Hours End' },
        { key: 'total_rings', label: 'Total Rings' },
        { key: 'answered_rings', label: 'Answered Rings' },
        { key: 'missed_rings', label: 'Missed Rings' },
        { key: 'declined_rings', label: 'Declined Rings' },
        { key: 'created_at', label: 'Created At' },
      ];

      const csvContent = toCsv(doors, columns);
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="tapknock-doors-${source}-${nowIso}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 2. RINGS & CALL AUDIT EXPORT
    if (type === 'rings') {
      const rings = await dbQuery<any>(`
        SELECT 
          r.id,
          r.created_at,
          r.door_id,
          d.label as door_label,
          d.display_name as door_name,
          d.address_line as door_address,
          r.visitor_id,
          r.visitor_name,
          r.reason,
          r.status,
          r.duration_s,
          r.answered_by,
          ans.display_name as answered_by_name,
          ans.email as answered_by_email,
          r.answered_at,
          r.ended_at,
          r.lat,
          r.lng,
          r.distance_m,
          r.ip_city,
          r.ip_country,
          r.ip_mismatch,
          r.trust_badge,
          r.connection_type,
          r.fingerprint,
          r.message_type,
          r.message_text,
          r.media_mime,
          r.media_size,
          r.message_sent_at,
          r.message_read_at
        FROM rings r
        LEFT JOIN doors d ON d.id = r.door_id
        LEFT JOIN accounts ans ON ans.id = r.answered_by
        ORDER BY r.created_at DESC
      `);

      if (format === 'json') {
        return NextResponse.json({ source, type, count: rings.length, data: rings });
      }

      const columns = [
        { key: 'id', label: 'Ring ID' },
        { key: 'created_at', label: 'Call Timestamp (UTC)' },
        { key: 'door_name', label: 'Door Display Name' },
        { key: 'door_label', label: 'Door Label' },
        { key: 'door_id', label: 'Door ID' },
        { key: 'door_address', label: 'Door Address' },
        { key: 'visitor_name', label: 'Visitor Name' },
        { key: 'visitor_id', label: 'Visitor ID' },
        { key: 'reason', label: 'Ring Reason' },
        { key: 'status', label: 'Call Outcome' },
        { key: 'duration_s', label: 'Call Duration (s)' },
        { key: 'answered_by_name', label: 'Answered By' },
        { key: 'answered_by_email', label: 'Answered By Email' },
        { key: 'answered_at', label: 'Answered At' },
        { key: 'ended_at', label: 'Ended At' },
        { key: 'lat', label: 'Caller GPS Lat' },
        { key: 'lng', label: 'Caller GPS Lng' },
        { key: 'distance_m', label: 'Distance from Door (m)' },
        { key: 'ip_city', label: 'Caller City' },
        { key: 'ip_country', label: 'Caller Country' },
        { key: 'ip_mismatch', label: 'IP Geofence Mismatch' },
        { key: 'trust_badge', label: 'Trust Badge' },
        { key: 'connection_type', label: 'Connection Type' },
        { key: 'fingerprint', label: 'Device Fingerprint' },
        { key: 'message_type', label: 'Recorded Message Type' },
        { key: 'message_text', label: 'Recorded Message Content' },
        { key: 'media_mime', label: 'Media MIME' },
        { key: 'media_size', label: 'Media Size (Bytes)' },
        { key: 'message_sent_at', label: 'Message Sent Timestamp' },
        { key: 'message_read_at', label: 'Message Read Timestamp' },
      ];

      const csvContent = toCsv(rings, columns);
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="tapknock-rings-${source}-${nowIso}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 3. USERS & ACCOUNTS EXPORT
    if (type === 'users') {
      const users = await dbQuery<any>(`
        SELECT 
          a.id,
          a.email,
          a.display_name,
          a.address_line,
          a.address_area,
          a.postcode,
          a.state,
          a.dob,
          a.created_at,
          (SELECT count(*) FROM doors d WHERE d.owner_id = a.id) as doors_owned,
          (SELECT count(*) FROM household h WHERE h.account_id = a.id) as household_memberships
        FROM accounts a
        WHERE a.deleted_at IS NULL
        ORDER BY a.created_at DESC
      `);

      if (format === 'json') {
        return NextResponse.json({ source, type, count: users.length, data: users });
      }

      const columns = [
        { key: 'id', label: 'Account ID' },
        { key: 'email', label: 'Email Address' },
        { key: 'display_name', label: 'Display Name' },
        { key: 'address_line', label: 'Address Line' },
        { key: 'address_area', label: 'Area / Suburb' },
        { key: 'postcode', label: 'Postcode' },
        { key: 'state', label: 'State / Province' },
        { key: 'dob', label: 'Date of Birth' },
        { key: 'doors_owned', label: 'Doors Owned' },
        { key: 'household_memberships', label: 'Household Memberships' },
        { key: 'created_at', label: 'Registered Date' },
      ];

      const csvContent = toCsv(users, columns);
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="tapknock-users-${source}-${nowIso}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 4. OVERVIEW / EXECUTIVE SUMMARY
    if (type === 'overview') {
      const accountsCount = (await dbQuery<any>('SELECT count(*) as count FROM accounts WHERE deleted_at IS NULL'))[0]?.count ?? '0';
      const doorsCount = (await dbQuery<any>('SELECT count(*) as count FROM doors'))[0]?.count ?? '0';
      const ringsCount = (await dbQuery<any>('SELECT count(*) as count FROM rings'))[0]?.count ?? '0';
      const answeredCount = (await dbQuery<any>("SELECT count(*) as count FROM rings WHERE status = 'answered'"))[0]?.count ?? '0';
      const missedCount = (await dbQuery<any>("SELECT count(*) as count FROM rings WHERE status = 'missed'"))[0]?.count ?? '0';
      const declinedCount = (await dbQuery<any>("SELECT count(*) as count FROM rings WHERE status = 'declined'"))[0]?.count ?? '0';
      const notifCount = (await dbQuery<any>('SELECT count(*) as count FROM push_notifications'))[0]?.count ?? '0';
      const totalR = parseInt(ringsCount, 10);
      const ansR = parseInt(answeredCount, 10);
      const answerRate = totalR > 0 ? ((ansR / totalR) * 100).toFixed(1) + '%' : '0%';

      const outcomes = await dbQuery<any>(
        'SELECT status, count(*) as count FROM rings GROUP BY status ORDER BY count DESC'
      );

      const dailyRings = await dbQuery<any>(`
        SELECT SUBSTRING(created_at, 1, 10) as date, status, count(*) as count
        FROM rings
        GROUP BY SUBSTRING(created_at, 1, 10), status
        ORDER BY date DESC
        LIMIT 30
      `);

      if (format === 'json') {
        return NextResponse.json({
          source,
          exported_at: new Date().toISOString(),
          kpis: {
            total_accounts: accountsCount,
            total_doors: doorsCount,
            total_rings: ringsCount,
            answered_rings: answeredCount,
            missed_rings: missedCount,
            declined_rings: declinedCount,
            answer_rate: answerRate,
            push_notifications: notifCount,
          },
          outcomes,
          daily_activity: dailyRings,
        });
      }

      // Format clean CSV summary
      let summaryCsv = '\uFEFF=== TAPKNOCK EXECUTIVE ANALYTICS SUMMARY ===\r\n';
      summaryCsv += `Database Source,${source.toUpperCase()}\r\n`;
      summaryCsv += `Exported At,${new Date().toISOString()}\r\n\r\n`;

      summaryCsv += '=== KEY PERFORMANCE INDICATORS ===\r\n';
      summaryCsv += 'Metric,Value\r\n';
      summaryCsv += `Total Registered Accounts,${accountsCount}\r\n`;
      summaryCsv += `Total Doors / Smart Access Points,${doorsCount}\r\n`;
      summaryCsv += `Total Visitor Rings,${ringsCount}\r\n`;
      summaryCsv += `Answered Rings,${answeredCount}\r\n`;
      summaryCsv += `Missed Rings,${missedCount}\r\n`;
      summaryCsv += `Declined Rings,${declinedCount}\r\n`;
      summaryCsv += `Overall Answer Rate,${answerRate}\r\n`;
      summaryCsv += `Push Notifications Dispatched,${notifCount}\r\n\r\n`;

      summaryCsv += '=== OUTCOMES BREAKDOWN ===\r\n';
      summaryCsv += 'Outcome Status,Ring Count\r\n';
      outcomes.forEach((o: any) => {
        summaryCsv += `${escapeCsvField(o.status)},${escapeCsvField(o.count)}\r\n`;
      });
      summaryCsv += '\r\n';

      summaryCsv += '=== DAILY CALL ACTIVITY (RECENT 30 DAYS) ===\r\n';
      summaryCsv += 'Date,Status,Count\r\n';
      dailyRings.forEach((r: any) => {
        summaryCsv += `${escapeCsvField(r.date)},${escapeCsvField(r.status)},${escapeCsvField(r.count)}\r\n`;
      });

      return new NextResponse(summaryCsv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="tapknock-analytics-summary-${source}-${nowIso}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    // 5. ALL-IN-ONE BUNDLE
    if (type === 'all') {
      const [accounts, doors, rings, notifications, blocklist] = await Promise.all([
        dbQuery<any>('SELECT id, email, display_name, address_line, address_area, postcode, state, created_at FROM accounts WHERE deleted_at IS NULL ORDER BY created_at DESC'),
        dbQuery<any>('SELECT d.*, c.public_code FROM doors d LEFT JOIN codes c ON c.door_id = d.id AND c.revoked_at IS NULL ORDER BY d.created_at DESC'),
        dbQuery<any>('SELECT * FROM rings ORDER BY created_at DESC'),
        dbQuery<any>('SELECT * FROM push_notifications ORDER BY created_at DESC'),
        dbQuery<any>('SELECT * FROM blocklist ORDER BY created_at DESC'),
      ]);

      const bundle = {
        platform: 'TapKnock Smart Doorbell',
        source_database: source,
        exported_at: new Date().toISOString(),
        summary: {
          total_accounts: accounts.length,
          total_doors: doors.length,
          total_rings: rings.length,
          total_notifications: notifications.length,
          total_blocked_entries: blocklist.length,
        },
        accounts,
        doors,
        rings,
        push_notifications: notifications,
        blocklist,
      };

      if (format === 'json') {
        return new NextResponse(JSON.stringify(bundle, null, 2), {
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="tapknock-complete-analytics-${source}-${nowIso}.json"`,
            'Cache-Control': 'no-store',
          },
        });
      }

      // If CSV requested for "all", generate unified master call log
      const ringsExtended = await dbQuery<any>(`
        SELECT 
          r.id as ring_id,
          r.created_at as ring_time,
          d.display_name as door_name,
          d.label as door_label,
          d.address_line as door_address,
          d.lat as door_lat,
          d.lng as door_lng,
          c.public_code as public_qr_code,
          a.email as door_owner_email,
          r.visitor_name,
          r.reason,
          r.status as ring_status,
          r.duration_s,
          ans.email as answered_by_email,
          r.lat as visitor_lat,
          r.lng as visitor_lng,
          r.distance_m,
          r.ip_city,
          r.ip_country,
          r.trust_badge,
          r.message_type,
          r.message_text
        FROM rings r
        LEFT JOIN doors d ON d.id = r.door_id
        LEFT JOIN accounts a ON a.id = d.owner_id
        LEFT JOIN codes c ON c.door_id = d.id AND c.revoked_at IS NULL
        LEFT JOIN accounts ans ON ans.id = r.answered_by
        ORDER BY r.created_at DESC
      `);

      const columns = [
        { key: 'ring_id', label: 'Ring ID' },
        { key: 'ring_time', label: 'Call Time' },
        { key: 'door_name', label: 'Door Name' },
        { key: 'door_label', label: 'Door Label' },
        { key: 'public_qr_code', label: 'QR Code' },
        { key: 'door_owner_email', label: 'Door Owner Email' },
        { key: 'door_address', label: 'Door Address' },
        { key: 'door_lat', label: 'Door Lat' },
        { key: 'door_lng', label: 'Door Lng' },
        { key: 'visitor_name', label: 'Visitor' },
        { key: 'reason', label: 'Reason' },
        { key: 'ring_status', label: 'Outcome' },
        { key: 'duration_s', label: 'Duration (s)' },
        { key: 'answered_by_email', label: 'Answered By' },
        { key: 'visitor_lat', label: 'Visitor Lat' },
        { key: 'visitor_lng', label: 'Visitor Lng' },
        { key: 'distance_m', label: 'Distance (m)' },
        { key: 'ip_city', label: 'Visitor City' },
        { key: 'ip_country', label: 'Visitor Country' },
        { key: 'trust_badge', label: 'Trust Badge' },
        { key: 'message_type', label: 'Message Type' },
        { key: 'message_text', label: 'Message' },
      ];

      const csvContent = toCsv(ringsExtended, columns);
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="tapknock-master-analytics-${source}-${nowIso}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({ error: 'invalid_type', message: 'Supported types: doors, rings, users, overview, all' }, { status: 400 });
  } catch (err: any) {
    console.error('Export API error:', err);
    return NextResponse.json({ error: 'export_failed', message: err.message }, { status: 500 });
  }
}
