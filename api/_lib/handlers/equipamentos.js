import { query } from '../db.js';
import { requireAuth, requirePerfil, podeAcessarContrato } from '../auth.js';
import { logHistorico } from '../audit.js';

const CAMPOS_FIXOS = ['identificador', 'tipo', 'categoria', 'piso', 'data_recarga', 'data_th', 'data_manutencao', 'status', 'foto_url'];

function splitCampos(campos) {
  const fixos = {};
  const dinamicos = {};
  for (const [k, v] of Object.entries(campos || {})) {
    if (CAMPOS_FIXOS.includes(k)) fixos[k] = v;
    else dinamicos[k] = v;
  }
  return { fixos, dinamicos };
}

export async function listar(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;
  const contratoId = String(data.contratoId || '').trim();
  if (!contratoId) return { ok: false, error: 'contratoId obrigatório' };
  if (!podeAcessarContrato(auth.session, contratoId)) return { ok: false, error: 'Sem acesso', status: 403 };

  const { rows } = await query(
    `SELECT id, identificador, tipo, categoria, piso, data_recarga, data_th, data_manutencao,
            status, foto_url, dados, loja_id, ponto_id, atualizado_em
       FROM equipamentos WHERE contrato_id = $1
       ORDER BY categoria NULLS LAST, piso NULLS LAST, identificador`,
    [contratoId]
  );
  return { ok: true, equipamentos: rows };
}

export async function salvar(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;
  const perm = requirePerfil(auth.session, ['supervisor', 'gestao', 'campo']);
  if (!perm.ok) return perm;

  const contratoId = String(data.contratoId || '').trim();
  if (!contratoId) return { ok: false, error: 'contratoId obrigatório' };
  if (!podeAcessarContrato(auth.session, contratoId)) return { ok: false, error: 'Sem acesso', status: 403 };

  const id = data.id ? Number(data.id) : null;
  const identificador = String(data.equipamentoId || data.identificador || '').trim() || null;
  const localInstalacao = String(data.localInstalacao || '').trim() || null;

  const { fixos, dinamicos } = splitCampos(data.campos);
  if (data.foto_url) fixos.foto_url = data.foto_url;

  const sets = [];
  const params = [];
  let i = 1;
  for (const [k, v] of Object.entries(fixos)) {
    sets.push(`${k} = $${i++}`); params.push(v);
  }
  if (Object.keys(dinamicos).length) {
    sets.push(`dados = COALESCE(dados, '{}'::jsonb) || $${i++}::jsonb`);
    params.push(JSON.stringify(dinamicos));
  }
  if (!sets.length) return { ok: false, error: 'Nenhum campo enviado' };

  let where, whereParams;
  if (id) {
    where = `id = $${i++} AND contrato_id = $${i++}`;
    whereParams = [id, contratoId];
  } else if (identificador) {
    where = `contrato_id = $${i++} AND identificador = $${i++}`;
    whereParams = [contratoId, identificador];
  } else if (localInstalacao) {
    where = `contrato_id = $${i++} AND dados->>'LOCAL DE INSTALAÇÃO' = $${i++}`;
    whereParams = [contratoId, localInstalacao];
  } else {
    return { ok: false, error: 'Identifique o equipamento via id, identificador ou localInstalacao' };
  }

  const sql = `UPDATE equipamentos SET ${sets.join(', ')} WHERE ${where} RETURNING *`;
  const { rows } = await query(sql, [...params, ...whereParams]);
  if (!rows.length) return { ok: false, error: 'Equipamento não encontrado' };

  await logHistorico({
    contratoId, email: auth.session.email,
    acao: 'atualizar_equipamento', entidadeTipo: 'equipamento',
    entidadeId: String(rows[0].id),
    detalhes: { campos: data.campos || {}, fotoUrl: data.foto_url || null },
    ip: ctx.ip
  });

  return { ok: true, equipamento: rows[0] };
}
