import { NextRequest, NextResponse } from 'next/server';
import { query, queryStaging, getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Fetch database-level size and connection count for both databases
    const dbStatsSql = `
      SELECT 
        pg_database.datname,
        pg_size_pretty(pg_database_size(pg_database.datname)) AS size,
        pg_database_size(pg_database.datname) AS size_bytes,
        count(pg_stat_activity.pid)::int AS connections
      FROM pg_database
      LEFT JOIN pg_stat_activity ON pg_database.datname = pg_stat_activity.datname
      WHERE pg_database.datname IN ('tapknock', 'tapknock_staging')
      GROUP BY pg_database.datname;
    `;

    const dbStats = await query(dbStatsSql);
    const prodStat = dbStats.find((s: any) => s.datname === 'tapknock') || {
      datname: 'tapknock',
      size: 'Unknown',
      size_bytes: 0,
      connections: 0,
    };
    const stagingStat = dbStats.find((s: any) => s.datname === 'tapknock_staging') || {
      datname: 'tapknock_staging',
      size: 'Unknown',
      size_bytes: 0,
      connections: 0,
    };

    // 2. Fetch table details for production
    const tablesSql = `
      SELECT 
        t.relname AS name,
        COALESCE(t.n_live_tup, 0)::int AS row_estimate,
        pg_size_pretty(pg_total_relation_size(t.relid)) AS size,
        pg_total_relation_size(t.relid)::bigint AS size_bytes,
        (
          SELECT count(*)::int 
          FROM information_schema.columns c 
          WHERE c.table_name = t.relname AND c.table_schema = 'public'
        ) AS column_count
      FROM pg_stat_user_tables t
      ORDER BY t.relname ASC;
    `;

    let prodTables: any[] = [];
    let stagingTables: any[] = [];
    let prodCacheHit = 99.0;
    let stagingCacheHit = 99.0;
    let pgVersion = '';
    let pgStartTime = '';

    try {
      prodTables = await query(tablesSql);
      // Fetch exact counts for small/medium tables
      for (const t of prodTables) {
        try {
          const exactRes = await query(`SELECT count(*)::int AS cnt FROM "${t.name}"`);
          t.exact_rows = exactRes[0]?.cnt ?? t.row_estimate;
        } catch {
          t.exact_rows = t.row_estimate;
        }
      }

      const cacheHitRes = await query(`
        SELECT COALESCE(
          ROUND((sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100)::numeric, 2),
          100.00
        )::float AS cache_hit_ratio 
        FROM pg_statio_user_tables;
      `);
      prodCacheHit = cacheHitRes[0]?.cache_hit_ratio ?? 100;

      const verRes = await query(`SELECT version(), pg_postmaster_start_time()::text AS start_time;`);
      pgVersion = verRes[0]?.version?.split(' on ')[0] || 'PostgreSQL';
      pgStartTime = verRes[0]?.start_time || '';
    } catch (e: any) {
      console.error('Error fetching prod database stats:', e);
    }

    try {
      stagingTables = await queryStaging(tablesSql);
      for (const t of stagingTables) {
        try {
          const exactRes = await queryStaging(`SELECT count(*)::int AS cnt FROM "${t.name}"`);
          t.exact_rows = exactRes[0]?.cnt ?? t.row_estimate;
        } catch {
          t.exact_rows = t.row_estimate;
        }
      }

      const cacheHitRes = await queryStaging(`
        SELECT COALESCE(
          ROUND((sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100)::numeric, 2),
          100.00
        )::float AS cache_hit_ratio 
        FROM pg_statio_user_tables;
      `);
      stagingCacheHit = cacheHitRes[0]?.cache_hit_ratio ?? 100;
    } catch (e: any) {
      console.error('Error fetching staging database stats:', e);
    }

    const prodTotalRows = prodTables.reduce((sum, t) => sum + (t.exact_rows || 0), 0);
    const stagingTotalRows = stagingTables.reduce((sum, t) => sum + (t.exact_rows || 0), 0);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      engine: 'PostgreSQL',
      version: pgVersion,
      serverStartTime: pgStartTime,
      databases: {
        production: {
          name: 'tapknock',
          label: 'Production Database',
          status: 'online',
          size: prodStat.size,
          sizeBytes: Number(prodStat.size_bytes) || 0,
          connections: prodStat.connections,
          tableCount: prodTables.length,
          totalRows: prodTotalRows,
          cacheHitRatio: prodCacheHit,
          tables: prodTables,
        },
        staging: {
          name: 'tapknock_staging',
          label: 'Staging Database',
          status: stagingTables.length > 0 ? 'online' : 'unreachable',
          size: stagingStat.size,
          sizeBytes: Number(stagingStat.size_bytes) || 0,
          connections: stagingStat.connections,
          tableCount: stagingTables.length,
          totalRows: stagingTotalRows,
          cacheHitRatio: stagingCacheHit,
          tables: stagingTables,
        },
      },
    });
  } catch (error: any) {
    console.error('Database overview route error:', error);
    return NextResponse.json(
      { error: 'overview_failed', message: error.message || 'Failed to query database overview' },
      { status: 500 }
    );
  }
}
