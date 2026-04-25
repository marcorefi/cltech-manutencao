import { query, withTransaction } from '../db.js';
import { requireAuth, requirePerfil, podeAcessarContrato } from '../auth.js';
import { logHistorico } from '../audit.js';

const CAMPOS_FIXOS = ['point_name', 'identificador', 'data_manutencao', 'status'];

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

  const params = [contratoId];
  let where = `contrato_id = $1`;
  if (data.central) {
    params.push(String(data.central));
    where += ` AND dados->>'CENTRAL' = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT id, point_name, identificador, data_manutencao, status, dados, atualizado_em
       FROM pontos WHERE ${where} ORDER BY point_name`,
    params
  );
  return { ok: true, pontos: rows };
}

export async function obter(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;
  const contratoId = String(data.contratoId || '').trim();
  const pointName = String(data.pointName || '').trim();
  if (!contratoId || !pointName) return { ok: false, error: 'contratoId e pointName obrigatórios' };
  if (!podeAcessarContrato(auth.session, contratoId)) return { ok: false, error: 'Sem acesso', status: 403 };

  const pontoQ = await query(
    `SELECT * FROM pontos WHERE contrato_id = $1 AND point_name = $2`,
    [contratoId, pointName]
  );
  if (!pontoQ.rows.length) return { ok: false, error: 'Ponto não encontrado' };

  const histQ = await query(
    `SELECT ts, usuario_email, acao, detalhes
       FROM historico
      WHERE contrato_id = $1 AND entidade_tipo = 'ponto' AND entidade_id = $2
      ORDER BY ts DESC LIMIT 100`,
    [contratoId, pointName]
  );

  return { ok: true, ponto: pontoQ.rows[0], historico: histQ.rows };
}

export async function salvar(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;
  const perm = requirePerfil(auth.session, ['supervisor', 'gestao', 'campo']);
  if (!perm.ok) return perm;

  const contratoId = String(data.contratoId || '').trim();
  const pointName = String(data.pointName || '').trim();
  if (!contratoId || !pointName) return { ok: false, error: 'contratoId e pointName obrigatórios' };
  if (!podeAcessarContrato(auth.session, contratoId)) return { ok: false, error: 'Sem acesso', status: 403 };

  const { fixos, dinamicos } = splitCampos(data.campos);

  const sets = [];
  const params = [contratoId, pointName];
  let i = 3;
  for (const [k, v] of Object.entries(fixos)) {
    if (k === 'point_name') continue;
    sets.push(`${k} = $${i++}`); params.push(v);
  }
  if (Object.keys(dinamicos).length) {
    sets.push(`dados = COALESCE(dados, '{}'::jsonb) || $${i++}::jsonb`);
    params.push(JSON.stringify(dinamicos));
  }

  let result;
  if (sets.length) {
    const { rows } = await query(
      `UPDATE pontos SET ${sets.join(', ')}
         WHERE contrato_id = $1 AND point_name = $2
         RETURNING *`,
      params
    );
    if (!rows.length) return { ok: false, error: 'Ponto não encontrado' };
    result = rows[0];
  } else {
    return { ok: false, error: 'Nenhum campo enviado' };
  }

  await logHistorico({
    contratoId, email: auth.session.email,
    acao: 'manutencao_ponto', entidadeTipo: 'ponto', entidadeId: pointName,
    detalhes: { campos: data.campos || {}, fotoUrl: data.fotoUrl || null },
    ip: ctx.ip
  });

  return { ok: true, ponto: result };
}

export async function adicionar(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;
  const perm = requirePerfil(auth.session, ['supervisor', 'gestao']);
  if (!perm.ok) return perm;

  const contratoId = String(data.contratoId || '').trim();
  if (!contratoId) return { ok: false, error: 'contratoId obrigatório' };

  const { fixos, dinamicos } = splitCampos(data.campos);
  if (!fixos.point_name) return { ok: false, error: 'point_name obrigatório' };

  const { rows } = await query(
    `INSERT INTO pontos (contrato_id, point_name, identificador, data_manutencao, status, dados)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (contrato_id, point_name) DO NOTHING
     RETURNING *`,
    [contratoId, fixos.point_name, fixos.identificador || null, fixos.data_manutencao || null, fixos.status || null, JSON.stringify(dinamicos || {})]
  );

  if (!rows.length) return { ok: false, error: 'Ponto já existe' };

  await logHistorico({
    contratoId, email: auth.session.email,
    acao: 'criar_ponto', entidadeTipo: 'ponto', entidadeId: fixos.point_name,
    ip: ctx.ip
  });

  return { ok: true, ponto: rows[0] };
}

export async function bulkInserir(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;
  const perm = requirePerfil(auth.session, ['supervisor', 'gestao']);
  if (!perm.ok) return perm;

  const contratoId = String(data.contratoId || '').trim();
  const pontos = Array.isArray(data.pontos) ? data.pontos : [];
  if (!contratoId || !pontos.length) return { ok: false, error: 'contratoId e pontos[] obrigatórios' };

  const inseridos = await withTransaction(async (client) => {
    let count = 0;
    for (const p of pontos) {
      const { fixos, dinamicos } = splitCampos(p);
      if (!fixos.point_name) continue;
      const r = await client.query(
        `INSERT INTO pontos (contrato_id, point_name, identificador, data_manutencao, status, dados)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (contrato_id, point_name) DO NOTHING`,
        [contratoId, fixos.point_name, fixos.identificador || null, fixos.data_manutencao || null, fixos.status || null, JSON.stringify(dinamicos || {})]
      );
      count += r.rowCount;
    }
    return count;
  });

  await logHistorico({
    contratoId, email: auth.session.email,
    acao: 'bulk_inserir_pontos', entidadeTipo: 'contrato', entidadeId: contratoId,
    detalhes: { total_enviado: pontos.length, inseridos }, ip: ctx.ip
  });

  return { ok: true, inseridos, totalEnviado: pontos.length };
}
