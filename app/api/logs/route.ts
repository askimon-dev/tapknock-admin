import { NextRequest, NextResponse } from 'next/server';
import { getContainerStatus, getParsedContainerLogs } from '@/lib/docker';

const SERVER_CONTAINER_MAP: Record<string, string> = {
  production: 'tapknock',
  prod: 'tapknock',
  staging: 'tapknock-staging',
  admin: 'tapknock-admin',
  postgres: 'tapknock-postgres',
  db: 'tapknock-postgres',
};

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serverKey = (searchParams.get('server') || 'production').toLowerCase();
    const containerName = SERVER_CONTAINER_MAP[serverKey] || serverKey;

    const tailParam = parseInt(searchParams.get('tail') || '200', 10);
    const tail = Math.min(Math.max(tailParam || 200, 10), 2500);

    const streamFilter = (searchParams.get('stream') || 'all').toLowerCase();
    const searchFilter = (searchParams.get('search') || '').trim().toLowerCase();

    // 1. Fetch container health & status
    const status = await getContainerStatus(containerName);

    // 2. Fetch parsed logs
    const { entries: allEntries, rawText, error } = await getParsedContainerLogs(containerName, tail);

    // 3. Apply optional server-side filters
    let filteredEntries = allEntries;
    if (streamFilter === 'stdout' || streamFilter === 'stderr') {
      filteredEntries = filteredEntries.filter((e) => e.stream === streamFilter);
    }

    if (searchFilter) {
      filteredEntries = filteredEntries.filter(
        (e) =>
          e.message.toLowerCase().includes(searchFilter) ||
          e.level.toLowerCase().includes(searchFilter)
      );
    }

    return NextResponse.json({
      ok: true,
      server: serverKey,
      containerName,
      status,
      entries: filteredEntries,
      totalCount: filteredEntries.length,
      rawCount: allEntries.length,
      rawText,
      error: error || null,
      polledAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error fetching server logs:', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'failed_to_fetch_logs',
        message: err.message,
        entries: [],
        rawText: '',
      },
      { status: 500 }
    );
  }
}
