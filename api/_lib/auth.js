import { query } from './db.js';
import { hmacSign, hmacVerify, sha256Hex, randomToken } from './crypto.js';

const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 8);

export function buildToken(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = hmacSign(body);
  return `${body}.${sig}`;
}

export function parseToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  if (!hmacVerify(body, sig)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export async function createSession(email, opts = {}) {
  const tokenPlain = randomToken(32);
  const tokenHash = sha256Hex(tokenPlain);
  const expiraEm = new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000);
  await query(
    `INSERT INTO sessoes (token, email, expira_em, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5)`,
    [tokenHash, email, expiraEm, opts.ip || null, opts.userAgent || null]
  );
  const payload = { email, exp: Math.floor(expiraEm.getTime() / 1000), tok: tokenPlain };
  return { token: buildToken(payload), expiraEm };
}

export async function validateSession(token) {
  const payload = parseToken(token);
  if (!payload) return null;
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;
  if (!payload.tok || !payload.email) return null;

  const tokenHash = sha256Hex(payload.tok);
  const { rows } = await query(
    `SELECT s.email, s.expira_em, u.nome, u.perfil, u.contratos, u.ativo
       FROM sessoes s
       JOIN usuarios u ON u.email = s.email
      WHERE s.token = $1 AND s.expira_em > NOW()
      LIMIT 1`,
    [tokenHash]
  );
  if (!rows.length) return null;
  const row = rows[0];
  if (!row.ativo) return null;
  return {
    email: row.email,
    nome: row.nome,
    perfil: row.perfil,
    contratos: row.contratos,
    expiraEm: row.expira_em
  };
}

export async function revokeSession(token) {
  const payload = parseToken(token);
  if (!payload?.tok) return;
  const tokenHash = sha256Hex(payload.tok);
  await query(`DELETE FROM sessoes WHERE token = $1`, [tokenHash]);
}

export function readToken(req, body = {}) {
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  if (match) return match[1];
  return body.token || null;
}

export async function requireAuth(req, body = {}) {
  const token = readToken(req, body);
  if (!token) return { ok: false, error: 'Token ausente', status: 401 };
  const session = await validateSession(token);
  if (!session) return { ok: false, error: 'Sessão inválida ou expirada', status: 401 };
  return { ok: true, session, token };
}

export function requirePerfil(session, perfis) {
  if (!perfis.includes(session.perfil)) {
    return { ok: false, error: 'Sem permissão. Requer: ' + perfis.join(', '), status: 403 };
  }
  return { ok: true };
}

export function podeAcessarContrato(session, contratoId) {
  if (session.perfil === 'supervisor' || session.perfil === 'gestao') return true;
  const lista = String(session.contratos || '').split(',').map(s => s.trim());
  return lista.includes('*') || lista.includes(contratoId);
}
