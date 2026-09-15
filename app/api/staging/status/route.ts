import { NextResponse } from 'next/server';
import { getContainerStatus } from '@/lib/docker';
import { query, queryStaging } from '@/lib/db';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Container status
    const container = await getContainerStatus('tapknock-staging');

    // 2. Staging DB stats
    let stagingDb: {
      connected: boolean;
      accounts: number;
      doors: number;
      rings: number;
      size?: string;
      error?: string;
    } = { connected: false, accounts: 0, doors: 0, rings: 0 };

    try {
      const counts = await queryStaging<{ table_name: string; count: string }>(`
        SELECT 'accounts' AS table_name, count(*) FROM accounts
        UNION ALL SELECT 'doors', count(*) FROM doors
        UNION ALL SELECT 'rings', count(*) FROM rings;
      `);
      const sizeRes = await queryStaging<{ size: string }>(
        "SELECT pg_size_pretty(pg_database_size('tapknock_staging')) as size"
      );

      const map = Object.fromEntries(counts.map((r) => [r.table_name, parseInt(r.count, 10)]));
      stagingDb = {
        connected: true,
        accounts: map.accounts || 0,
        doors: map.doors || 0,
        rings: map.rings || 0,
        size: sizeRes[0]?.size || 'Unknown',
      };
    } catch (dbErr: any) {
      stagingDb = {
        connected: false,
        accounts: 0,
        doors: 0,
        rings: 0,
        error: dbErr.message,
      };
    }

    // 3. Production DB stats for comparison
    let prodDb = { accounts: 0, doors: 0, rings: 0, size: 'Unknown' };
    try {
      const prodCounts = await query<{ table_name: string; count: string }>(`
        SELECT 'accounts' AS table_name, count(*) FROM accounts
        UNION ALL SELECT 'doors', count(*) FROM doors
        UNION ALL SELECT 'rings', count(*) FROM rings;
      `);
      const prodSizeRes = await query<{ size: string }>(
        "SELECT pg_size_pretty(pg_database_size('tapknock')) as size"
      );
      const prodMap = Object.fromEntries(
        prodCounts.map((r) => [r.table_name, parseInt(r.count, 10)])
      );
      prodDb = {
        accounts: prodMap.accounts || 0,
        doors: prodMap.doors || 0,
        rings: prodMap.rings || 0,
        size: prodSizeRes[0]?.size || 'Unknown',
      };
    } catch {}

    // 4. Snapshots & Backups list
    const snapshots: { name: string; size: string; mtime: string }[] = [];
    const backupDir = '/opt/tapknock-backups';
    try {
      if (fs.existsSync(backupDir)) {
        const files = fs.readdirSync(backupDir);
        for (const file of files) {
          if (file.endsWith('.sql') || file.endsWith('.tar.gz') || file.endsWith('.db')) {
            const stat = fs.statSync(path.join(backupDir, file));
            const sizeKb = Math.round(stat.size / 1024);
            const sizeStr = sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;
            snapshots.push({
              name: file,
              size: sizeStr,
              mtime: stat.mtime.toISOString(),
            });
          }
        }
      }
    } catch {}

    // Sort newest first
    snapshots.sort((a, b) => (a.mtime > b.mtime ? -1 : 1));

    // Staging endpoints
    const endpoints = {
      http: 'https://staging.tapknock.generalquery.xyz',
      httpDirect: 'http://64.227.155.199:8081',
      ws: 'wss://staging.tapknock.generalquery.xyz/ws',
      wsDirect: 'ws://64.227.155.199:8081/ws',
      port: 8081,
      dbUrl: 'postgresql://tapknock:••••••••@postgres:5432/tapknock_staging',
      secret: 'staging_889115fb86213899476d566caa6dbb83ddaf4170d05c37cf28fdb71c69ae8d9c',
    };

    return NextResponse.json({
      container,
      stagingDb,
      prodDb,
      snapshots,
      endpoints,
      serverTime: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'staging_status_failed', message: err.message },
      { status: 500 }
    );
  }
}
