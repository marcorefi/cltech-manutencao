// CLTECH Fire - Utilitários
window.Utils = (function() {
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(d) {
    if (!d) return '';
    const date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date)) return String(d);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR').substring(0, 5);
  }

  function formatDateOnly(d) {
    if (!d) return '';
    const date = (d instanceof Date) ? d : new Date(d);
    if (isNaN(date)) return String(d);
    return date.toLocaleDateString('pt-BR');
  }

  function statusClass(status) {
    return 'status-' + String(status || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function showLoading() {
    const existing = document.getElementById('loadingOverlay');
    if (existing) return;
    const div = document.createElement('div');
    div.id = 'loadingOverlay';
    div.className = 'loading-overlay';
    div.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(div);
  }

  function hideLoading() {
    const el = document.getElementById('loadingOverlay');
    if (el) el.remove();
  }

  function toast(msg, type) {
    type = type || 'info';
    const div = document.createElement('div');
    div.className = 'alert alert-' + type;
    div.style.cssText = 'position:fixed;top:80px;right:20px;z-index:2000;min-width:240px;max-width:360px;box-shadow:0 4px 16px rgba(0,0,0,0.2)';
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(function() { div.remove(); }, 4500);
  }

  // Converte File (input de foto) para base64 (com compressão)
  function fileToCompressedBase64(file, maxWidth, quality) {
    maxWidth = maxWidth || 1600;
    quality = quality || 0.75;
    return new Promise(function(resolve, reject) {
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          let w = img.width;
          let h = img.height;
          if (w > maxWidth) {
            h = h * (maxWidth / w);
            w = maxWidth;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const base64 = canvas.toDataURL('image/jpeg', quality);
          resolve({ base64: base64, mime: 'image/jpeg' });
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function setContrato(contrato) {
    localStorage.setItem(window.APP_CONFIG.CONTRATO_KEY, JSON.stringify(contrato));
  }

  function getContrato() {
    try {
      return JSON.parse(localStorage.getItem(window.APP_CONFIG.CONTRATO_KEY) || 'null');
    } catch (e) { return null; }
  }

  return {
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    formatDateOnly: formatDateOnly,
    statusClass: statusClass,
    showLoading: showLoading,
    hideLoading: hideLoading,
    toast: toast,
    fileToCompressedBase64: fileToCompressedBase64,
    getQueryParam: getQueryParam,
    setContrato: setContrato,
    getContrato: getContrato
  };
})();
