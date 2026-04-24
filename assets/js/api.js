// GestorPrev - Cliente da API (Apps Script Web App)
// Uso: API.call('auth', { email, senha }) => Promise<Result>

window.API = (function() {
  function getUrl() {
    return window.APP_CONFIG.API_URL || localStorage.getItem('gestorprev_api_url') || '';
  }

  function setUrl(url) {
    localStorage.setItem('gestorprev_api_url', url);
    window.APP_CONFIG.API_URL = url;
  }

  async function doFetch(url, body, timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(function() { ctrl.abort(); }, timeoutMs || 30000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
      const text = await res.text();
      return { status: res.status, text: text };
    } finally {
      clearTimeout(timer);
    }
  }

  function friendlyError(err) {
    const msg = (err && err.message) || String(err || '');
    if (msg.indexOf('Failed to fetch') !== -1 || msg.indexOf('NetworkError') !== -1) {
      return 'Sem conexão com o servidor. Verifique sua internet e tente de novo.';
    }
    if (msg.indexOf('aborted') !== -1 || msg.indexOf('AbortError') !== -1) {
      return 'O servidor demorou demais para responder. Tente de novo.';
    }
    return msg || 'Erro desconhecido';
  }

  async function call(action, payload) {
    const url = getUrl();
    if (!url) {
      return { ok: false, error: 'URL da API não configurada. Abra Configurações avançadas.' };
    }

    payload = payload || {};

    const session = window.AUTH && window.AUTH.getSession();
    if (session && session.token && !payload.token) {
      payload.token = session.token;
    }

    const body = Object.assign({ action: action }, payload);
    const QUEUEABLE = ['salvarLoja', 'salvarPonto', 'salvarEquipamento', 'adicionarPonto', 'criarUsuario', 'atualizarUsuario', 'removerUsuario', 'criarContrato'];

    // Offline de verdade: enfileira mutantes, erro leigo pra leitura
    if (!navigator.onLine) {
      if (window.Offline && QUEUEABLE.indexOf(action) !== -1) {
        await window.Offline.enqueue(action, payload);
        return { ok: true, queued: true, offline: true, message: 'Ação salva offline. Será sincronizada ao reconectar.' };
      }
      return { ok: false, error: 'Você está offline.' };
    }

    // Retry automático: tenta 2 vezes para erros de rede transientes
    let lastErr;
    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        const res = await doFetch(url, body, 30000);
        const text = res.text;
        let json;
        try {
          json = JSON.parse(text);
        } catch (e) {
          // Resposta HTML ou vazia — Apps Script pode ter tido hiccup
          lastErr = new Error('Resposta inválida do servidor (HTTP ' + res.status + ')');
          if (tentativa === 1) { await new Promise(r => setTimeout(r, 700)); continue; }
          return { ok: false, error: friendlyError(lastErr) };
        }

        // Sessão expirada/inválida → logout silencioso
        if (!json.ok && json.error) {
          const e = String(json.error || '');
          if (e.indexOf('expirada') !== -1 || e.indexOf('Token inválido') !== -1 || e.indexOf('Token ausente') !== -1) {
            if (window.AUTH) window.AUTH.logout(true);
          }
        }
        return json;
      } catch (err) {
        lastErr = err;
        // Tentativa 1 falhou: espera 700ms e tenta de novo
        if (tentativa === 1) {
          await new Promise(r => setTimeout(r, 700));
          continue;
        }
      }
    }

    // Ambas tentativas falharam → enfileirar se mutante, senão retornar erro amigável
    if (window.Offline && QUEUEABLE.indexOf(action) !== -1) {
      try {
        await window.Offline.enqueue(action, payload);
        return { ok: true, queued: true, offline: true, message: 'Ação salva (rede instável). Será reenviada.' };
      } catch (e) {}
    }
    return { ok: false, error: friendlyError(lastErr) };
  }

  async function ping() {
    return call('ping');
  }

  return {
    getUrl: getUrl,
    setUrl: setUrl,
    call: call,
    ping: ping
  };
})();
