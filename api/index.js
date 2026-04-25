// GestorPrev — API entrypoint (Vercel Serverless Function)
// Roteia ações por `action` recebido em GET (query) ou POST (body JSON).

import { actions } from './_lib/handlers/index.js';
import { logAcesso, clientIp, userAgent } from './_lib/audit.js';

function setCors(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

function send(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return {}; }
    }
    return req.body;
  }
  return await new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
  const origin = req.headers?.origin || '';
  setCors(res, origin);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const url = new URL(req.url, 'http://x');
  const queryParams = Object.fromEntries(url.searchParams.entries());
  const body = req.method === 'POST' ? await readBody(req) : {};
  const data = { ...queryParams, ...body };
  const action = data.action || '';

  if (!action) return send(res, 400, { ok: false, error: 'Parâmetro "action" obrigatório' });

  const handlerFn = actions[action];
  if (!handlerFn) return send(res, 404, { ok: false, error: 'Ação desconhecida: ' + action });

  const ctx = { req, res, ip: clientIp(req), userAgent: userAgent(req) };

  try {
    const result = await handlerFn(data, ctx);
    const status = result?.status || (result?.ok === false ? 400 : 200);
    if (result?.status) delete result.status;
    return send(res, status, result);
  } catch (err) {
    console.error('[api]', action, 'erro:', err);
    await logAcesso({
      email: data.email || null,
      evento: 'erro_servidor',
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      detalhes: { action, message: err.message }
    });
    return send(res, 500, { ok: false, error: 'Erro interno', detalhes: err.message });
  }
}
