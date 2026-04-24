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
          <button class="bell-btn" id="bellBtn" onclick="AUTH.toggleAlerts()" title="Alertas">
            <span class="bell-ico">🔔</span>
            <span class="bell-badge" id="bellBadge" style="display:none">0</span>
          </button>
          <span>${s.usuario.nome}</span>
          <span class="badge ${perfil}">${perfilLabel}</span>
          <button class="logout" onclick="AUTH.logout()">Sair</button>
        </div>
      </div>
      <div id="alertsPanel" class="alerts-panel" style="display:none"></div>
    `;
  }

  async function loadAlerts() {
    if (!window.API) return;
    const res = await window.API.call('notificacoes');
    if (!res.ok) return;
    const alertas = res.alertas || [];
    const badge = document.getElementById('bellBadge');
    if (badge) {
      if (alertas.length > 0) {
        badge.textContent = alertas.length > 99 ? '99+' : alertas.length;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
    renderAlertsPanel(alertas);
  }

  function renderAlertsPanel(alertas) {
    const el = document.getElementById('alertsPanel');
    if (!el) return;
    if (!alertas.length) {
      el.innerHTML = '<div style="padding:20px;color:#64748B;font-size:13px;text-align:center">Nenhum alerta no momento ✓</div>';
      return;
    }
    const byContrato = {};
    alertas.forEach(a => {
      byContrato[a.contratoNome] = byContrato[a.contratoNome] || [];
      byContrato[a.contratoNome].push(a);
    });
    let html = '<div class="alerts-header">Alertas (' + alertas.length + ')</div>';
    Object.keys(byContrato).forEach(nome => {
      html += '<div class="alerts-group">' + nome + '</div>';
      byContrato[nome].slice(0, 30).forEach(a => {
        let label, cls;
        if (a.tipo === 'alarme') { label = 'ALARME'; cls = 'alarme'; }
        else if (a.tipo === 'vencida') { label = a.diasAtraso + 'd vencida'; cls = 'alarme'; }
        else { label = 'em ' + a.diasRestantes + 'd'; cls = 'pendencia'; }
        html += '<div class="alerts-item"><span class="alerts-tag ' + cls + '">' + label + '</span>' +
                '<span class="alerts-id">' + (a.identificador || '') + '</span>' +
                (a.nome ? '<span class="alerts-name">' + a.nome + '</span>' : '') +
                (a.data ? '<span class="alerts-date">' + a.data + '</span>' : '') +
                '</div>';
      });
      if (byContrato[nome].length > 30) {
        html += '<div style="padding:6px 14px;font-size:11px;color:#64748B">+ ' + (byContrato[nome].length - 30) + ' mais</div>';
      }
    });
    el.innerHTML = html;
  }

  function toggleAlerts() {
    const el = document.getElementById('alertsPanel');
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
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
    renderLgpdFooter: renderLgpdFooter,
    loadAlerts: loadAlerts,
    toggleAlerts: toggleAlerts
  };
})();

// Auto-carrega alertas após 2s quando logado
window.addEventListener('load', () => {
  if (window.AUTH && window.AUTH.getSession()) {
    setTimeout(() => window.AUTH.loadAlerts(), 2000);
  }
});
