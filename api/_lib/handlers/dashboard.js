import { query } from '../db.js';
import { requireAuth, podeAcessarContrato } from '../auth.js';

export async function resumo(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;

  const contratoId = String(data.contratoId || '').trim();
  if (!contratoId) return { ok: false, error: 'contratoId obrigatório' };
  if (!podeAcessarContrato(auth.session, contratoId)) return { ok: false, error: 'Sem acesso', status: 403 };

  const cQ = await query(`SELECT id, nome, tipo FROM contratos WHERE id = $1`, [contratoId]);
  if (!cQ.rows.length) return { ok: false, error: 'Contrato não encontrado' };
  const contrato = cQ.rows[0];

  if (contrato.tipo === 'A') return resumoTipoA(contratoId, contrato);
  return resumoTipoB(contratoId, contrato);
}

async function resumoTipoA(contratoId, contrato) {
  const lojas = await query(
    `SELECT status, dados->>'PISO' AS piso,
            COALESCE(dados->>'INTERLIGADA', '') AS interligada,
            COALESCE(dados->>'POSSUI MÓDULO', dados->>'POSSUI MODULO', '') AS modulo
       FROM lojas WHERE contrato_id = $1`,
    [contratoId]
  );

  const byStatus = {};
  const byPiso = {};
  let interligadas = 0, comModulo = 0;
  for (const r of lojas.rows) {
    const st = (r.status || '').toUpperCase() || 'SEM_STATUS';
    byStatus[st] = (byStatus[st] || 0) + 1;
    const piso = r.piso || 'SEM_PISO';
    byPiso[piso] = byPiso[piso] || { total: 0, conforme: 0, pendencia: 0, alarme: 0 };
    byPiso[piso].total++;
    if (st === 'CONFORME') byPiso[piso].conforme++;
    if (st === 'PENDÊNCIA' || st === 'PENDENCIA') byPiso[piso].pendencia++;
    if (st === 'ALARME') byPiso[piso].alarme++;
    if (String(r.interligada).toUpperCase() === 'SIM') interligadas++;
    if (String(r.modulo).toUpperCase() === 'SIM') comModulo++;
  }

  const equipQ = await query(
    `SELECT categoria, tipo, piso, data_manutencao
       FROM equipamentos WHERE contrato_id = $1`,
    [contratoId]
  );
  const eqByCategoria = {}, eqByTipo = {}, eqByPiso = {};
  let semManutencao = 0, manutMaisDeSeisMeses = 0;
  const seisMesesMs = 180 * 24 * 60 * 60 * 1000;
  const hoje = Date.now();
  for (const e of equipQ.rows) {
    eqByCategoria[e.categoria || 'SEM_CATEGORIA'] = (eqByCategoria[e.categoria || 'SEM_CATEGORIA'] || 0) + 1;
    eqByTipo[e.tipo || 'OUTROS'] = (eqByTipo[e.tipo || 'OUTROS'] || 0) + 1;
    eqByPiso[e.piso || '-'] = (eqByPiso[e.piso || '-'] || 0) + 1;
    if (!e.data_manutencao) semManutencao++;
    else if ((hoje - new Date(e.data_manutencao).getTime()) > seisMesesMs) manutMaisDeSeisMeses++;
  }

  return {
    ok: true,
    tipoContrato: 'A',
    contrato,
    total: lojas.rows.length,
    byStatus, byPiso,
    interligadas, comModulo,
    equipamentos: {
      total: equipQ.rows.length,
      byCategoria: eqByCategoria, byTipo: eqByTipo, byPiso: eqByPiso,
      semManutencao, manutMaisDeSeisMeses
    }
  };
}

async function resumoTipoB(contratoId, contrato) {
  const { rows } = await query(
    `SELECT
       COALESCE(dados->>'VISITA', 'PENDENTE') AS visita,
       COALESCE(dados->>'CENTRAL', 'SEM_CENTRAL') AS central,
       COALESCE(dados->>'DEVICE TYPE', 'OUTROS') AS device
       FROM pontos WHERE contrato_id = $1`,
    [contratoId]
  );

  const byVisita = {};
  const byCentral = {};
  const byDevice = {};
  for (const r of rows) {
    const visita = String(r.visita).toUpperCase();
    byVisita[visita] = (byVisita[visita] || 0) + 1;
    byCentral[r.central] = byCentral[r.central] || { total: 0, realizadas: 0, pendentes: 0 };
    byCentral[r.central].total++;
    if (visita === 'REALIZADA') byCentral[r.central].realizadas++;
    else byCentral[r.central].pendentes++;
    byDevice[r.device] = (byDevice[r.device] || 0) + 1;
  }

  return {
    ok: true,
    tipoContrato: 'B',
    contrato,
    total: rows.length,
    byVisita, byCentral, byDevice
  };
}

export async function notificacoes(data, ctx) {
  const auth = await requireAuth(ctx.req, data);
  if (!auth.ok) return auth;

  const { rows: contratos } = await query(`SELECT id, nome, tipo FROM contratos WHERE ativo = true`);
  const acessiveis = contratos.filter(c => podeAcessarContrato(auth.session, c.id));
  if (!acessiveis.length) return { ok: true, alertas: [], total: 0 };

  const ids = acessiveis.map(c => c.id);
  const alertas = [];

  const pontosVencendo = await query(
    `SELECT contrato_id, point_name AS identificador, dados->>'DATA PRÓX MANUTENÇÃO' AS prox
       FROM pontos
      WHERE contrato_id = ANY($1::varchar[])
        AND dados ? 'DATA PRÓX MANUTENÇÃO'`,
    [ids]
  );
  const hoje = new Date();
  for (const p of pontosVencendo.rows) {
    if (!p.prox) continue;
    const proxDate = new Date(p.prox);
    if (isNaN(proxDate)) continue;
    const diff = Math.floor((proxDate - hoje) / 86400000);
    const c = acessiveis.find(x => x.id === p.contrato_id);
    if (diff < 0) alertas.push({ contratoId: p.contrato_id, contratoNome: c?.nome, identificador: p.identificador, tipo: 'vencida', diasAtraso: -diff, data: proxDate.toISOString().slice(0,10) });
    else if (diff <= 15) alertas.push({ contratoId: p.contrato_id, contratoNome: c?.nome, identificador: p.identificador, tipo: 'proxima', diasRestantes: diff, data: proxDate.toISOString().slice(0,10) });
  }

  const lojasAlarme = await query(
    `SELECT contrato_id, identificador, nome
       FROM lojas
      WHERE contrato_id = ANY($1::varchar[])
        AND UPPER(COALESCE(status, '')) = 'ALARME'`,
    [ids]
  );
  for (const l of lojasAlarme.rows) {
    const c = acessiveis.find(x => x.id === l.contrato_id);
    alertas.push({ contratoId: l.contrato_id, contratoNome: c?.nome, identificador: l.identificador, nome: l.nome, tipo: 'alarme' });
  }

  const equipVencer = await query(
    `SELECT contrato_id, identificador, tipo, dias_restantes
       FROM equipamentos_a_vencer
      WHERE contrato_id = ANY($1::varchar[])`,
    [ids]
  );
  for (const e of equipVencer.rows) {
    const c = acessiveis.find(x => x.id === e.contrato_id);
    alertas.push({ contratoId: e.contrato_id, contratoNome: c?.nome, identificador: e.identificador, tipo: 'equip_vencer', diasRestantes: e.dias_restantes, equipamento: e.tipo });
  }

  return { ok: true, alertas, total: alertas.length };
}
