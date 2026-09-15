import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Doors with location and ring metrics
    const doors = await query<any>(`
      SELECT 
        d.id, 
        d.label, 
        d.display_name, 
        d.address_line, 
        d.lat, 
        d.lng, 
        d.radius_m, 
        d.is_active, 
        d.created_at,
        a.email as owner_email,
        a.display_name as owner_name,
        c.public_code,
        COUNT(r.id)::int as ring_count,
        COUNT(CASE WHEN r.status = 'answered' THEN 1 END)::int as answered_count,
        COUNT(CASE WHEN r.status = 'missed' THEN 1 END)::int as missed_count,
        COUNT(CASE WHEN r.message_text IS NOT NULL OR r.media_path IS NOT NULL THEN 1 END)::int as message_count
      FROM doors d
      LEFT JOIN accounts a ON a.id = d.owner_id
      LEFT JOIN codes c ON c.door_id = d.id AND c.revoked_at IS NULL
      LEFT JOIN rings r ON r.door_id = d.id
      GROUP BY d.id, d.label, d.display_name, d.address_line, d.lat, d.lng, d.radius_m, d.is_active, d.created_at, a.email, a.display_name, c.public_code
      ORDER BY ring_count DESC, d.created_at DESC;
    `);

    // 2. Rings with direct coordinates or associated door coordinates
    const rings = await query<any>(`
      SELECT 
        r.id,
        r.door_id,
        COALESCE(r.lat, d.lat) as lat,
        COALESCE(r.lng, d.lng) as lng,
        r.distance_m,
        r.ip_city,
        r.ip_country,
        r.trust_badge,
        r.status,
        r.reason,
        r.created_at,
        r.visitor_name,
        d.label as door_label,
        d.display_name as door_name
      FROM rings r
      LEFT JOIN doors d ON d.id = r.door_id
      WHERE (r.lat IS NOT NULL AND r.lng IS NOT NULL) OR (d.lat IS NOT NULL AND d.lng IS NOT NULL)
      ORDER BY r.created_at DESC
      LIMIT 500;
    `);

    // 3. Construct heat points (lat, lng, weight)
    const heatPoints: { lat: number; lng: number; weight: number; label: string }[] = [];

    // Add doors with location (weight scaled by usage)
    doors.forEach((door: any) => {
      const lat = parseFloat(door.lat);
      const lng = parseFloat(door.lng);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        const ringCount = door.ring_count || 0;
        const weight = Math.min(10, 1 + ringCount * 0.5);
        heatPoints.push({
          lat,
          lng,
          weight,
          label: door.display_name || door.label || 'Door',
        });
      }
    });

    // Add rings with location
    rings.forEach((ring: any) => {
      const lat = parseFloat(ring.lat);
      const lng = parseFloat(ring.lng);
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        heatPoints.push({
          lat,
          lng,
          weight: 1.0,
          label: `Ring: ${ring.visitor_name || ring.reason || 'Visitor'}`,
        });
      }
    });

    // Compute center and bounds
    let avgLat = 22.5726; // Default to India / West Bengal if no points
    let avgLng = 88.3639;
    if (heatPoints.length > 0) {
      const sumLat = heatPoints.reduce((acc, p) => acc + p.lat, 0);
      const sumLng = heatPoints.reduce((acc, p) => acc + p.lng, 0);
      avgLat = sumLat / heatPoints.length;
      avgLng = sumLng / heatPoints.length;
    }

    return NextResponse.json({
      doors,
      rings,
      heatPoints,
      center: { lat: avgLat, lng: avgLng },
      summary: {
        totalDoors: doors.length,
        doorsWithLocation: doors.filter((d: any) => d.lat && d.lng).length,
        totalRings: rings.length,
        ringsWithLocation: rings.filter((r: any) => r.lat && r.lng).length,
        totalHeatPoints: heatPoints.length,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: 'map_data_error', message: err.message }, { status: 500 });
  }
}
