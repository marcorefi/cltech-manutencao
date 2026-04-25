import { query } from '../db.js';
import { hashPassword } from '../crypto.js';
import { requireAuth, requirePerfil } from '../auth.js';
import { logHistorico } from '../audit.js';

const PERFIS = ['supervisor', 'gestao', 'campo', 'cliente'];

export async function listar(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;
  const perm = requirePerfil(auth.session, ['supervisor']);
  if (!perm.ok) return perm;

  const { rows } = await query(
    `SELECT email, nome, perfil, contratos, ativo, criado_em, criado_por
       FROM usuarios ORDER BY nome`
  );
  return { ok: true, usuarios: rows };
}

export async function criar(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;
  const perm = requirePerfil(auth.session, ['supervisor']);
  if (!perm.ok) return perm;

  const email = String(data.email || '').trim().toLowerCase();
  const nome = String(data.nome || '').trim();
  const senha = String(data.senha || '');
  const perfil = String(data.perfil || '').trim();
  const contratos = data.contratos || '*';

  if (!email || !nome || !senha || !perfil) return { ok: false, error: 'Campos obrigatórios: email, nome, senha, perfil' };
  if (!PERFIS.includes(perfil)) return { ok: false, error: 'Perfil inválido. Use: ' + PERFIS.join(', ') };

  const exists = await query(`SELECT 1 FROM usuarios WHERE email = $1`, [email]);
  if (exists.rows.length) return { ok: false, error: 'Email já cadastrado' };

  const hash = await hashPassword(senha);
  await query(
    `INSERT INTO usuarios (email, nome, senha_hash, perfil, contratos, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [email, nome, hash, perfil, contratos, auth.session.email]
  );

  await logHistorico({
    email: auth.session.email, acao: 'criar_usuario',
    entidadeTipo: 'usuario', entidadeId: email,
    detalhes: { nome, perfil, contratos }, ip: ctx.ip
  });

  return { ok: true, usuario: { email, nome, perfil, contratos } };
}

export async function atualizar(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;
  const perm = requirePerfil(auth.session, ['supervisor']);
  if (!perm.ok) return perm;

  const email = String(data.email || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Email obrigatório' };

  const updates = [];
  const params = [];
  let i = 1;
  if (data.nome !== undefined)     { updates.push(`nome = $${i++}`);         params.push(String(data.nome)); }
  if (data.senha)                  { updates.push(`senha_hash = $${i++}`);   params.push(await hashPassword(String(data.senha))); }
  if (data.perfil !== undefined && PERFIS.includes(data.perfil)) { updates.push(`perfil = $${i++}`); params.push(data.perfil); }
  if (data.contratos !== undefined){ updates.push(`contratos = $${i++}`);    params.push(String(data.contratos)); }
  if (data.ativo !== undefined)    { updates.push(`ativo = $${i++}`);        params.push(data.ativo === true || data.ativo === 'SIM' || data.ativo === 'true'); }

  if (!updates.length) return { ok: false, error: 'Nada para atualizar' };
  params.push(email);

  const sql = `UPDATE usuarios SET ${updates.join(', ')} WHERE email = $${i} RETURNING email, nome, perfil, contratos, ativo`;
  const { rows } = await query(sql, params);
  if (!rows.length) return { ok: false, error: 'Usuário não encontrado' };

  await logHistorico({
    email: auth.session.email, acao: 'atualizar_usuario',
    entidadeTipo: 'usuario', entidadeId: email,
    detalhes: { campos: Object.keys(data).filter(k => !['action','token','email'].includes(k)) }, ip: ctx.ip
  });

  return { ok: true, usuario: rows[0] };
}

export async function remover(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;
  const perm = requirePerfil(auth.session, ['supervisor']);
  if (!perm.ok) return perm;

  const email = String(data.email || '').trim().toLowerCase();
  if (!email) return { ok: false, error: 'Email obrigatório' };
  if (email === auth.session.email) return { ok: false, error: 'Não pode remover a si mesmo' };

  const { rowCount } = await query(`DELETE FROM usuarios WHERE email = $1`, [email]);
  if (!rowCount) return { ok: false, error: 'Usuário não encontrado' };

  await logHistorico({
    email: auth.session.email, acao: 'remover_usuario',
    entidadeTipo: 'usuario', entidadeId: email, ip: ctx.ip
  });

  return { ok: true };
}
