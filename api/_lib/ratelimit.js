import { query } from './db.js';

const ATTEMPTS = Number(process.env.RATE_LIMIT_ATTEMPTS || 5);
const WINDOW_MIN = Number(process.env.RATE_LIMIT_WINDOW_MIN || 15);
const BLOCK_MIN = Number(process.env.RATE_LIMIT_BLOCK_MIN || 30);

export async function checkBlocked(email) {
  const { rows } = await query(
    `SELECT bloqueado_ate FROM bloqueio_tentativas
      WHERE email = $1 AND bloqueado_ate IS NOT NULL AND bloqueado_ate > NOW()`,
    [email]
  );
  if (!rows.length) return null;
  return rows[0].bloqueado_ate;
}

export async function registerFailure(email) {
  const { rows } = await query(
    `SELECT tentativas, primeira_em FROM bloqueio_tentativas WHERE email = $1`,
    [email]
  );
  const windowMs = WINDOW_MIN * 60 * 1000;

  if (!rows.length) {
    await query(
      `INSERT INTO bloqueio_tentativas (email, tentativas, primeira_em) VALUES ($1, 1, NOW())`,
      [email]
    );
    return { tentativas: 1, bloqueado: false };
  }

  const primeira = new Date(rows[0].primeira_em).getTime();
  if (Date.now() - primeira > windowMs) {
    await query(
      `UPDATE bloqueio_tentativas
          SET tentativas = 1, primeira_em = NOW(), bloqueado_ate = NULL
        WHERE email = $1`,
      [email]
    );
    return { tentativas: 1, bloqueado: false };
  }

  const novas = rows[0].tentativas + 1;
  if (novas >= ATTEMPTS) {
    const ate = new Date(Date.now() + BLOCK_MIN * 60 * 1000);
    await query(
      `UPDATE bloqueio_tentativas
          SET tentativas = $2, bloqueado_ate = $3
        WHERE email = $1`,
      [email, novas, ate]
    );
    return { tentativas: novas, bloqueado: true, ate };
  }
  await query(
    `UPDATE bloqueio_tentativas SET tentativas = $2 WHERE email = $1`,
    [email, novas]
  );
  return { tentativas: novas, bloqueado: false };
}

export async function clearFailures(email) {
  await query(`DELETE FROM bloqueio_tentativas WHERE email = $1`, [email]);
}
