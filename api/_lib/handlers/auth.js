import { query } from '../db.js';
import { verifyPassword } from '../crypto.js';
import { createSession, validateSession, revokeSession, readToken, requireAuth } from '../auth.js';
import { logAcesso } from '../audit.js';
import { checkBlocked, registerFailure, clearFailures } from '../ratelimit.js';

export async function ping() {
  return { ok: true, version: '2.0', timestamp: new Date().toISOString() };
}

export async function login(data, ctx) {
  const email = String(data.email || '').trim().toLowerCase();
  const senha = String(data.senha || '');
  if (!email || !senha) return { ok: false, error: 'Email e senha obrigatórios' };

  const blockedUntil = await checkBlocked(email);
  if (blockedUntil) {
    await logAcesso({ email, evento: 'login_bloqueado', ip: ctx.ip, userAgent: ctx.userAgent });
    return { ok: false, error: 'Muitas tentativas. Tente novamente após ' + new Date(blockedUntil).toLocaleString('pt-BR') };
  }

  const { rows } = await query(
    `SELECT email, nome, senha_hash, perfil, contratos, ativo
       FROM usuarios WHERE email = $1 LIMIT 1`,
    [email]
  );
  const user = rows[0];

  if (!user || !user.ativo) {
    await registerFailure(email);
    await logAcesso({ email, evento: 'login_falha', ip: ctx.ip, userAgent: ctx.userAgent, detalhes: { motivo: 'usuario_invalido' } });
    return { ok: false, error: 'Credenciais inválidas' };
  }

  const ok = await verifyPassword(senha, user.senha_hash);
  if (!ok) {
    const fail = await registerFailure(email);
    await logAcesso({ email, evento: 'login_falha', ip: ctx.ip, userAgent: ctx.userAgent, detalhes: { tentativas: fail.tentativas, bloqueado: fail.bloqueado } });
    return { ok: false, error: 'Credenciais inválidas' };
  }

  await clearFailures(email);
  const { token, expiraEm } = await createSession(email, { ip: ctx.ip, userAgent: ctx.userAgent });
  await logAcesso({ email, evento: 'login_sucesso', ip: ctx.ip, userAgent: ctx.userAgent });

  return {
    ok: true,
    token,
    usuario: { email: user.email, nome: user.nome, perfil: user.perfil, contratos: user.contratos },
    expiraEm: expiraEm.toISOString()
  };
}

export async function logout(data, ctx) {
  const token = readToken(ctx.req, data);
  if (token) {
    await revokeSession(token);
    await logAcesso({ email: data.email || null, evento: 'logout', ip: ctx.ip, userAgent: ctx.userAgent });
  }
  return { ok: true };
}

export async function me(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;
  const s = auth.session;
  return {
    ok: true,
    usuario: { email: s.email, nome: s.nome, perfil: s.perfil, contratos: s.contratos }
  };
}
