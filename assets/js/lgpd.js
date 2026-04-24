// GestorPrev - Gestão de consentimento LGPD
window.LGPD = (function() {
  const CONSENT_KEY = 'gestorprev_lgpd_consent';

  function hasConsent() {
    return localStorage.getItem(CONSENT_KEY) === '1';
  }

  function grantConsent() {
    localStorage.setItem(CONSENT_KEY, '1');
    const banner = document.getElementById('lgpdBanner');
    if (banner) banner.remove();
  }

  function renderBanner() {
    if (hasConsent()) return;
    const el = document.createElement('div');
    el.id = 'lgpdBanner';
    el.style.cssText = [
      'position:fixed','bottom:0','left:0','right:0','z-index:9999',
      'background:#0D1B2A','color:#CBD5E1','font-size:12px',
      'padding:14px 20px','display:flex','align-items:center',
      'gap:12px','flex-wrap:wrap','border-top:2px solid #1E40AF',
      'box-shadow:0 -4px 16px rgba(0,0,0,.4)'
    ].join(';');
    el.innerHTML = `
      <span style="flex:1;min-width:200px">
        Este sistema armazena dados de sessão localmente (localStorage) para autenticação.
        Nenhum dado pessoal sensível é coletado.
        <a href="privacy.html" target="_blank" style="color:#93C5FD;text-decoration:underline">Política de Privacidade</a>
      </span>
      <button id="lgpdAccept" style="
        background:#1E40AF;color:#fff;border:none;border-radius:6px;
        padding:8px 18px;cursor:pointer;font-size:12px;white-space:nowrap;font-family:inherit
      ">Entendi e aceito</button>
    `;
    document.body.appendChild(el);
    document.getElementById('lgpdAccept').addEventListener('click', grantConsent);
  }

  // Exibe o banner quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderBanner);
  } else {
    renderBanner();
  }

  return { hasConsent: hasConsent, grantConsent: grantConsent };
})();
