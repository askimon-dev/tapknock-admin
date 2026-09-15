import { NextRequest, NextResponse } from 'next/server';
import { queryTarget } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dbTarget = (searchParams.get('database') === 'staging' ? 'staging' : 'production') as 'production' | 'staging';
    const tableName = searchParams.get('table');

    // 1. Fetch all foreign keys in the database (for relationships / ERD)
    const fkSql = `
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
    `;
    const allForeignKeys = await queryTarget(dbTarget, fkSql);

    // If no specific table requested, return full database schema for ERD
    if (!tableName || tableName === 'all') {
      const allColsSql = `
        SELECT 
          c.table_name,
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          c.ordinal_position,
          EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_name = c.table_name
              AND kcu.column_name = c.column_name
              AND tc.table_schema = 'public'
          ) AS is_primary
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
        ORDER BY c.table_name, c.ordinal_position;
      `;
      const allCols = await queryTarget(dbTarget, allColsSql);

      // Group columns by table
      const tablesMap: Record<string, any[]> = {};
      for (const col of allCols) {
        if (!tablesMap[col.table_name]) {
          tablesMap[col.table_name] = [];
        }
        const fkMatch = allForeignKeys.find(
          (fk: any) => fk.table_name === col.table_name && fk.column_name === col.column_name
        );
        tablesMap[col.table_name].push({
          ...col,
          is_foreign: !!fkMatch,
          foreign_table: fkMatch?.foreign_table_name || null,
          foreign_column: fkMatch?.foreign_column_name || null,
        });
      }

      return NextResponse.json({
        database: dbTarget,
        tables: tablesMap,
        relationships: allForeignKeys,
      });
    }

    // Otherwise, fetch detailed schema for single table
    const colsSql = `
      SELECT 
        c.column_name, 
        c.data_type, 
        c.is_nullable, 
        c.column_default,
        c.ordinal_position,
        EXISTS (
          SELECT 1 
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_name = c.table_name
            AND kcu.column_name = c.column_name
            AND tc.table_schema = 'public'
        ) AS is_primary
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = $1
      ORDER BY c.ordinal_position;
    `;

    const rawColumns = await queryTarget(dbTarget, colsSql, [tableName]);
    const columns = rawColumns.map((col: any) => {
      const fkMatch = allForeignKeys.find(
        (fk: any) => fk.table_name === tableName && fk.column_name === col.column_name
      );
      return {
        ...col,
        is_foreign: !!fkMatch,
        foreign_table: fkMatch?.foreign_table_name || null,
        foreign_column: fkMatch?.foreign_column_name || null,
      };
    });

    // 2. Fetch indexes
    const indexSql = `
      SELECT
        i.relname AS index_name,
        pg_get_indexdef(idx.indexrelid) AS index_def,
        idx.indisunique AS is_unique,
        idx.indisprimary AS is_primary
      FROM pg_index idx
      JOIN pg_class t ON t.oid = idx.indrelid
      JOIN pg_class i ON i.oid = idx.indexrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'public' AND t.relname = $1
      ORDER BY i.relname;
    `;
    const indexes = await queryTarget(dbTarget, indexSql, [tableName]);

    // 3. Outgoing and incoming foreign key references
    const outgoingFks = allForeignKeys.filter((fk: any) => fk.table_name === tableName);
    const incomingFks = allForeignKeys.filter((fk: any) => fk.foreign_table_name === tableName);

    return NextResponse.json({
      database: dbTarget,
      table: tableName,
      columns,
      indexes,
      outgoingFks,
      incomingFks,
    });
  } catch (error: any) {
    console.error('Database schema route error:', error);
    return NextResponse.json(
      { error: 'schema_failed', message: error.message || 'Failed to fetch schema' },
      { status: 500 }
    );
  }
}
