import { query } from '../db.js';
import { requireAuth, requirePerfil, podeAcessarContrato } from '../auth.js';
import { logHistorico } from '../audit.js';

const CAMPOS_FIXOS = ['identificador', 'nome', 'data_manutencao', 'status'];

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
    `SELECT id, identificador, nome, data_manutencao, status, dados, atualizado_em
       FROM lojas WHERE contrato_id = $1 ORDER BY identificador`,
    [contratoId]
  );
  return { ok: true, lojas: rows };
}

export async function obter(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;
  const contratoId = String(data.contratoId || '').trim();
  const identificador = String(data.luc || data.identificador || '').trim();
  if (!contratoId || !identificador) return { ok: false, error: 'contratoId e identificador obrigatórios' };
  if (!podeAcessarContrato(auth.session, contratoId)) return { ok: false, error: 'Sem acesso', status: 403 };

  const lojaQ = await query(
    `SELECT * FROM lojas WHERE contrato_id = $1 AND identificador = $2`,
    [contratoId, identificador]
  );
  if (!lojaQ.rows.length) return { ok: false, error: 'Loja não encontrada' };

  const histQ = await query(
    `SELECT ts, usuario_email, acao, detalhes
       FROM historico
      WHERE contrato_id = $1 AND entidade_tipo = 'loja' AND entidade_id = $2
      ORDER BY ts DESC LIMIT 100`,
    [contratoId, identificador]
  );

  return { ok: true, loja: lojaQ.rows[0], historico: histQ.rows };
}

export async function salvar(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;
  const perm = requirePerfil(auth.session, ['supervisor', 'gestao', 'campo']);
  if (!perm.ok) return perm;

  const contratoId = String(data.contratoId || '').trim();
  const identificador = String(data.luc || data.identificador || '').trim();
  if (!contratoId || !identificador) return { ok: false, error: 'contratoId e identificador obrigatórios' };
  if (!podeAcessarContrato(auth.session, contratoId)) return { ok: false, error: 'Sem acesso', status: 403 };

  const { fixos, dinamicos } = splitCampos(data.campos);

  const sets = [];
  const params = [contratoId, identificador];
  let i = 3;
  for (const [k, v] of Object.entries(fixos)) {
    sets.push(`${k} = $${i++}`); params.push(v);
  }
  if (Object.keys(dinamicos).length) {
    sets.push(`dados = COALESCE(dados, '{}'::jsonb) || $${i++}::jsonb`);
    params.push(JSON.stringify(dinamicos));
  }

  let result;
  if (sets.length) {
    const { rows } = await query(
      `UPDATE lojas SET ${sets.join(', ')}
         WHERE contrato_id = $1 AND identificador = $2
         RETURNING *`,
      params
    );
    if (!rows.length) {
      const insertParams = [contratoId, identificador, fixos.nome || null, fixos.status || null, fixos.data_manutencao || null, JSON.stringify(dinamicos || {})];
      const ins = await query(
        `INSERT INTO lojas (contrato_id, identificador, nome, status, data_manutencao, dados)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        insertParams
      );
      result = ins.rows[0];
    } else {
      result = rows[0];
    }
  } else {
    return { ok: false, error: 'Nenhum campo enviado' };
  }

  await logHistorico({
    contratoId, email: auth.session.email,
    acao: 'atualizar_loja', entidadeTipo: 'loja', entidadeId: identificador,
    detalhes: { campos: data.campos || {}, fotoUrl: data.fotoUrl || null },
    ip: ctx.ip
  });

  return { ok: true, loja: result };
}
