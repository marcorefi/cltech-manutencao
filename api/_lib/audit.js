import { query } from './db.js';

export async function logAcesso({ email, evento, ip, userAgent, detalhes }) {
  try {
    await query(
      `INSERT INTO auditoria_acesso (email, evento, ip_address, user_agent, detalhes)
       VALUES ($1, $2, $3, $4, $5)`,
      [email || null, evento, ip || null, userAgent || null, detalhes ? JSON.stringify(detalhes) : '{}']
    );
  } catch (err) {
    console.error('[audit] auditoria_acesso falhou:', err.message);
  }
}

export async function logHistorico({ contratoId, email, acao, entidadeTipo, entidadeId, detalhes, ip }) {
  try {
    await query(
      `INSERT INTO historico (contrato_id, usuario_email, acao, entidade_tipo, entidade_id, detalhes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [contratoId || null, email || null, acao, entidadeTipo || null, entidadeId || null,
       detalhes ? JSON.stringify(detalhes) : '{}', ip || null]
    );
  } catch (err) {
    console.error('[audit] historico falhou:', err.message);
  }
}

export function clientIp(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.headers?.['x-real-ip'] || null;
}

export function userAgent(req) {
  return req.headers?.['user-agent'] || null;
}
