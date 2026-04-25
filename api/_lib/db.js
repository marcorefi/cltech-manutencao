// PostgreSQL connection pool (singleton para serverless)
import pg from 'pg';

const { Pool } = pg;

let pool;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL não definida');
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
    pool.on('error', (err) => console.error('[DB] Pool error:', err));
  }
  return pool;
}

export async function query(text, params) {
  const start = Date.now();
  const res = await getPool().query(text, params);
  const dur = Date.now() - start;
  if (dur > 500) console.warn(`[DB] Slow query ${dur}ms:`, text.substring(0, 80));
  return res;
}

export async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
