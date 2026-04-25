import { query } from '../db.js';
import { requireAuth, podeAcessarContrato } from '../auth.js';

export async function listar(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;

  const contratoId = String(data.contratoId || '').trim();
  const identificador = data.identificador !== undefined ? String(data.identificador) : null;

  if (!contratoId) return { ok: false, error: 'contratoId obrigatório' };
  if (!podeAcessarContrato(auth.session, contratoId)) return { ok: false, error: 'Sem acesso', status: 403 };

  const params = [contratoId];
  let where = `contrato_id = $1`;
  if (identificador) {
    params.push(identificador);
    where += ` AND entidade_id = $${params.length}`;
  }
  const limit = Math.min(Number(data.limit || 200), 500);
  params.push(limit);

  const { rows } = await query(
    `SELECT ts, usuario_email, acao, entidade_tipo, entidade_id, detalhes
       FROM historico WHERE ${where}
       ORDER BY ts DESC LIMIT $${params.length}`,
    params
  );
  return { ok: true, historico: rows };
}
