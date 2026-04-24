// CLTECH Fire - Gestão de sessão
window.AUTH = (function() {
  const KEY = window.APP_CONFIG.SESSION_KEY;

  function getSession() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (new Date(s.expiraEm) < new Date()) {
        localStorage.removeItem(KEY);
        return null;
      }
      return s;
    } catch (e) {
      return null;
    }
  }

  function setSession(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function logout(silent) {
    const s = getSession();
    if (s && s.token) {
      // Tenta notificar o backend
      window.API.call('logout', { token: s.token }).catch(function() {});
    }
    localStorage.removeItem(KEY);
    localStorage.removeItem(window.APP_CONFIG.CONTRATO_KEY);
    if (!silent) {
      window.location.href = 'index.html';
    }
  }

  function require(perfisPermitidos) {
    const s = getSession();
    if (!s) {
      window.location.href = 'index.html';
      return null;
    }
    if (perfisPermitidos && perfisPermitidos.length && perfisPermitidos.indexOf(s.usuario.perfil) === -1) {
      // Perfil não tem acesso — redirecionar para a página correta
      redirectByProfile(s.usuario.perfil);
      return null;
    }
    return s;
  }

  function redirectByProfile(perfil) {
    switch (perfil) {
      case 'supervisor':
      case 'gestao':
        window.location.href = 'supervisor.html';
        break;
      case 'campo':
        window.location.href = 'campo.html';
        break;
      case 'cliente':
        window.location.href = 'cliente.html';
        break;
      default:
        window.location.href = 'index.html';
    }
  }

  async function login(email, senha) {
    const res = await window.API.call('auth', { email: email, senha: senha });
    if (res.ok) {
      setSession({
        token: res.token,
        usuario: res.usuario,
        expiraEm: res.expiraEm
      });
    }
    return res;
  }

  function renderHeader(titulo, subtitulo) {
    const s = getSession();
    if (!s) return '';
    const perfil = s.usuario.perfil;
    const perfilLabel = {
      supervisor: 'Supervisor',
      gestao: 'Gestão',
      campo: 'Campo',
      cliente: 'Cliente'
    }[perfil] || perfil;

    return `
      <div class="header">
        <div class="brand">
          <div class="brand-logo"><img src="assets/img/cltech-shield.png" alt="CLTECH Fire"></div>
          <div>
            <h1>${titulo || 'CLTECH Fire'}</h1>
            <div class="sub">${subtitulo || 'Sistema de Contratos de Manutenção'}</div>
          </div>
        </div>
        <div class="user-box">
          <span>${s.usuario.nome}</span>
          <span class="badge ${perfil}">${perfilLabel}</span>
          <button class="logout" onclick="AUTH.logout()">Sair</button>
        </div>
      </div>
    `;
  }

  function renderLgpdFooter() {
    return `
      <div class="lgpd-footer">
        <strong>© 2026 CLTECH Fire</strong> — CNPJ: ${window.APP_CONFIG.CNPJ}<br>
        Sistema em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).<br>
        Os dados coletados são exclusivamente técnicos, destinados à gestão de manutenção,
        e não incluem dados pessoais sensíveis. Acesso restrito a usuários autorizados.
      </div>
    `;
  }

  return {
    getSession: getSession,
    setSession: setSession,
    logout: logout,
    require: require,
    redirectByProfile: redirectByProfile,
    login: login,
    renderHeader: renderHeader,
    renderLgpdFooter: renderLgpdFooter
  };
})();
