// Aplica migrações SQL pendentes em db/migrations/
// Estratégia simples: cada arquivo é aplicado uma vez (registrado em schema_migrations).
// Uso: node scripts/migrate.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '..', '.env.local');
const migDir = resolve(__dirname, '..', 'db', 'migrations');

try {
  const env = readFileSync(envPath, 'utf8');
  for (const line of env.split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  console.error('[migrate] .env.local não encontrado em', envPath);
  process.exit(1);
}

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('[YOUR-PASSWORD]')) {
  console.error('[migrate] DATABASE_URL inválida — substitua [YOUR-PASSWORD] em .env.local');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      file VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const arquivos = readdirSync(migDir).filter(f => f.endsWith('.sql')).sort();
  for (const file of arquivos) {
    const exists = await pool.query(`SELECT 1 FROM schema_migrations WHERE file = $1`, [file]);
    if (exists.rows.length) {
      console.log('[migrate] já aplicado:', file);
      continue;
    }
    console.log('[migrate] aplicando:', file);
    const sql = readFileSync(resolve(migDir, file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (file) VALUES ($1)`, [file]);
      await client.query('COMMIT');
      console.log('[migrate] ok:', file);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[migrate] falha em', file, '—', err.message);
      throw err;
    } finally {
      client.release();
    }
  }
  await pool.end();
  console.log('[migrate] tudo aplicado');
}

run().catch((err) => { console.error(err); process.exit(1); });
