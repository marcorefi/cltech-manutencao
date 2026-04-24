// CLTECH Fire - Cliente da API (Apps Script Web App)
// Uso: API.call('auth', { email, senha }) => Promise<Result>

window.API = (function() {
  function getUrl() {
    return window.APP_CONFIG.API_URL || localStorage.getItem('cltech_api_url') || '';
  }

  function setUrl(url) {
    localStorage.setItem('cltech_api_url', url);
    window.APP_CONFIG.API_URL = url;
  }

  async function call(action, payload) {
    const url = getUrl();
    if (!url) {
      throw new Error('URL da API não configurada. Configure em /config');
    }

    payload = payload || {};

    // Token automático se sessão existir
    const session = window.AUTH && window.AUTH.getSession();
    if (session && session.token && !payload.token) {
      payload.token = session.token;
    }

    const body = Object.assign({ action: action }, payload);

    // Ações que podem ser enfileiradas quando offline (mutantes)
    const QUEUEABLE = ['salvarLoja', 'salvarPonto', 'adicionarPonto', 'criarUsuario', 'atualizarUsuario', 'removerUsuario', 'criarContrato'];

    try {
      if (!navigator.onLine && window.Offline && QUEUEABLE.indexOf(action) !== -1) {
        await window.Offline.enqueue(action, payload);
        return { ok: true, queued: true, offline: true, message: 'Ação enfileirada. Será sincronizada quando a conexão voltar.' };
      }

      const res = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
      });

      const text = await res.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error('Resposta inválida da API: ' + text.substring(0, 200));
      }

      if (!json.ok && json.error) {
        if (json.error.indexOf('expirada') !== -1 || json.error.indexOf('inválido') !== -1) {
          if (window.AUTH) window.AUTH.logout(true);
        }
      }

      return json;
    } catch (err) {
      // Erro de rede em ação mutante: enfileirar
      if (window.Offline && QUEUEABLE.indexOf(action) !== -1) {
        try {
          await window.Offline.enqueue(action, payload);
          return { ok: true, queued: true, offline: true, message: 'Ação enfileirada (rede indisponível).' };
        } catch (e) {}
      }
      return { ok: false, error: err.message || 'Erro de rede' };
    }
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
