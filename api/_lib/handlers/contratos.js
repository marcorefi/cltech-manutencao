import { query } from '../db.js';
import { requireAuth, requirePerfil, podeAcessarContrato } from '../auth.js';
import { logHistorico } from '../audit.js';

export async function listar(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;

  const { rows } = await query(
    `SELECT id, nome, slug, tipo, has_categorias, campos_loja, campos_ponto, campos_equipamento, ativo
       FROM contratos WHERE ativo = true ORDER BY nome`
  );
  const filtrados = rows.filter(c => podeAcessarContrato(auth.session, c.id));
  return { ok: true, contratos: filtrados };
}

export async function obter(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;

  const id = String(data.id || data.contratoId || '').trim();
  if (!id) return { ok: false, error: 'id obrigatório' };
  if (!podeAcessarContrato(auth.session, id)) return { ok: false, error: 'Sem acesso a este contrato', status: 403 };

  const { rows } = await query(`SELECT * FROM contratos WHERE id = $1`, [id]);
  if (!rows.length) return { ok: false, error: 'Contrato não encontrado' };
  return { ok: true, contrato: rows[0] };
}

export async function criar(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;
  const perm = requirePerfil(auth.session, ['supervisor']);
  if (!perm.ok) return perm;

  const id = String(data.id || '').trim().toLowerCase().replace(/\s+/g, '-');
  const nome = String(data.nome || '').trim();
  const slug = String(data.slug || id).trim();
  const tipo = String(data.tipo || data.tipoContrato || '').toUpperCase();

  if (!id || !nome || !['A','B'].includes(tipo)) return { ok: false, error: 'Campos obrigatórios: id, nome, tipo (A|B)' };

  await query(
    `INSERT INTO contratos (id, nome, slug, tipo, has_categorias, campos_loja, campos_ponto, campos_equipamento)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id, nome, slug, tipo,
      data.has_categorias === true,
      JSON.stringify(data.campos_loja || []),
      JSON.stringify(data.campos_ponto || []),
      JSON.stringify(data.campos_equipamento || [])
    ]
  );

  await logHistorico({
    email: auth.session.email, acao: 'criar_contrato',
    entidadeTipo: 'contrato', entidadeId: id,
    detalhes: { nome, tipo }, ip: ctx.ip, contratoId: id
  });

  return { ok: true, id };
}

export async function atualizar(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;
  const perm = requirePerfil(auth.session, ['supervisor']);
  if (!perm.ok) return perm;

  const id = String(data.id || '').trim();
  if (!id) return { ok: false, error: 'id obrigatório' };

  const updates = [];
  const params = [];
  let i = 1;
  for (const col of ['nome', 'slug', 'tipo', 'has_categorias', 'ativo']) {
    if (data[col] !== undefined) { updates.push(`${col} = $${i++}`); params.push(data[col]); }
  }
  for (const col of ['campos_loja', 'campos_ponto', 'campos_equipamento']) {
    if (data[col] !== undefined) { updates.push(`${col} = $${i++}`); params.push(JSON.stringify(data[col])); }
  }
  if (!updates.length) return { ok: false, error: 'Nada para atualizar' };
  params.push(id);

  const { rows } = await query(
    `UPDATE contratos SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
    params
  );
  if (!rows.length) return { ok: false, error: 'Contrato não encontrado' };

  await logHistorico({
    email: auth.session.email, acao: 'atualizar_contrato',
    entidadeTipo: 'contrato', entidadeId: id,
    contratoId: id, ip: ctx.ip
  });

  return { ok: true, contrato: rows[0] };
}
