import 'server-only';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

type QueryValue = string | number | boolean | Date | null;

declare global {
  var __mmPgPool: Pool | undefined;
}

const createPool = () => {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined. Configure PostgreSQL in .env.local');
  }

  const sslEnabled = process.env.PGSSL === 'true' || process.env.PGSSLMODE === 'require';

  return new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30_000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 5_000),
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
  });
};

export const getPool = () => {
  if (!global.__mmPgPool) {
    global.__mmPgPool = createPool();
  }
  return global.__mmPgPool;
};

export const dbQuery = async <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: QueryValue[] = [],
): Promise<QueryResult<T>> => {
  const pool = getPool();
  return pool.query<T>(text, params);
};

export const dbHealthcheck = async () => {
  const result = await dbQuery<{ now: string }>('SELECT NOW()::text as now');
  return {
    ok: true,
    now: result.rows[0]?.now,
  };
};

export const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>) => {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
