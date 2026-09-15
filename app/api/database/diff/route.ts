import { NextRequest, NextResponse } from 'next/server';
import { query, queryStaging } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tablesSql = `
      SELECT 
        t.relname AS name,
        COALESCE(t.n_live_tup, 0)::int AS row_estimate,
        pg_size_pretty(pg_total_relation_size(t.relid)) AS size,
        pg_total_relation_size(t.relid)::bigint AS size_bytes
      FROM pg_stat_user_tables t
      ORDER BY t.relname ASC;
    `;

    const colsSql = `
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `;

    const [prodTables, stagingTables, prodCols, stagingCols] = await Promise.all([
      query(tablesSql).catch(() => []),
      queryStaging(tablesSql).catch(() => []),
      query(colsSql).catch(() => []),
      queryStaging(colsSql).catch(() => []),
    ]);

    // Calculate exact row counts for production
    for (const t of prodTables) {
      try {
        const exact = await query(`SELECT count(*)::int AS cnt FROM "${t.name}"`);
        t.exact_rows = exact[0]?.cnt ?? t.row_estimate;
      } catch {
        t.exact_rows = t.row_estimate;
      }
    }

    // Calculate exact row counts for staging
    for (const t of stagingTables) {
      try {
        const exact = await queryStaging(`SELECT count(*)::int AS cnt FROM "${t.name}"`);
        t.exact_rows = exact[0]?.cnt ?? t.row_estimate;
      } catch {
        t.exact_rows = t.row_estimate;
      }
    }

    const allTableNames = Array.from(
      new Set([...prodTables.map((t: any) => t.name), ...stagingTables.map((t: any) => t.name)])
    ).sort();

    const comparisons = allTableNames.map((tableName) => {
      const prodT = prodTables.find((t: any) => t.name === tableName);
      const stagT = stagingTables.find((t: any) => t.name === tableName);

      const pCols = prodCols.filter((c: any) => c.table_name === tableName);
      const sCols = stagingCols.filter((c: any) => c.table_name === tableName);

      const missingInStaging = pCols.filter((pc: any) => !sCols.some((sc: any) => sc.column_name === pc.column_name));
      const missingInProd = sCols.filter((sc: any) => !pCols.some((pc: any) => pc.column_name === sc.column_name));
      const typeMismatches = pCols.filter((pc: any) => {
        const matching = sCols.find((sc: any) => sc.column_name === pc.column_name);
        return matching && matching.data_type !== pc.data_type;
      });

      const schemaMatches = missingInStaging.length === 0 && missingInProd.length === 0 && typeMismatches.length === 0;

      const prodRows = prodT?.exact_rows ?? null;
      const stagingRows = stagT?.exact_rows ?? null;
      const rowDiff = prodRows !== null && stagingRows !== null ? prodRows - stagingRows : null;

      return {
        tableName,
        existsInProd: !!prodT,
        existsInStaging: !!stagT,
        prodRows,
        stagingRows,
        rowDiff,
        prodSize: prodT?.size ?? 'N/A',
        stagingSize: stagT?.size ?? 'N/A',
        prodSizeBytes: prodT?.size_bytes ?? 0,
        stagingSizeBytes: stagT?.size_bytes ?? 0,
        columnCountProd: pCols.length,
        columnCountStaging: sCols.length,
        schemaMatches,
        schemaDiff: {
          missingInStaging: missingInStaging.map((c: any) => c.column_name),
          missingInProd: missingInProd.map((c: any) => c.column_name),
          typeMismatches: typeMismatches.map((c: any) => `${c.column_name} (prod: ${c.data_type} vs staging: ${sCols.find((sc: any) => sc.column_name === c.column_name)?.data_type})`),
        },
      };
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      prodTotalRows: prodTables.reduce((s: number, t: any) => s + (t.exact_rows || 0), 0),
      stagingTotalRows: stagingTables.reduce((s: number, t: any) => s + (t.exact_rows || 0), 0),
      tableCountProd: prodTables.length,
      tableCountStaging: stagingTables.length,
      comparisons,
    });
  } catch (error: any) {
    console.error('Database diff route error:', error);
    return NextResponse.json(
      { error: 'diff_failed', message: error.message || 'Failed to compare databases' },
      { status: 500 }
    );
  }
}
