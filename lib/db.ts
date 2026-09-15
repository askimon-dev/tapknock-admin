import { Pool } from 'pg';

// Global singleton pool across hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://tapknock:tapknock@localhost:5432/tapknock';

export const pool =
  global._pgPool ||
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== 'production') {
  global._pgPool = pool;
}

export const getPool = () => pool;

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.DEBUG_SQL === 'true') {
    console.log('[SQL]', { text, duration, rows: res.rowCount });
  }
  return res.rows as T[];
}

export async function queryOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

// Staging Database Pool
let _stagingPool: Pool | undefined;
export function getStagingPool(): Pool {
  if (!_stagingPool) {
    const baseConn =
      process.env.DATABASE_URL ||
      'postgresql://tapknock:tapknock@localhost:5432/tapknock';
    const stagingConn = baseConn.replace(/\/tapknock(\?.*)?$/, '/tapknock_staging$1');
    _stagingPool = new Pool({
      connectionString: stagingConn,
      max: 5,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 3000,
    });
  }
  return _stagingPool;
}

export async function queryStaging<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const p = getStagingPool();
  const res = await p.query(text, params);
  return res.rows as T[];
}

export async function queryStagingOne<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await queryStaging<T>(text, params);
  return rows[0] || null;
}

export function getDbPool(db: 'production' | 'staging' = 'production'): Pool {
  return db === 'staging' ? getStagingPool() : getPool();
}

export async function queryTarget<T = any>(db: 'production' | 'staging', text: string, params: any[] = []): Promise<T[]> {
  const p = getDbPool(db);
  const res = await p.query(text, params);
  return res.rows as T[];
}


