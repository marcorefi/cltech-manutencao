// GestorPrev - Registra Service Worker + inicializa offline queue
(function() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.warn('[SW] registro falhou', err);
      });
    });
  }
  // Inicializa fila offline
  if (window.Offline) {
    window.Offline.init().then(() => window.Offline.updateBadge()).catch(() => {});
  }
})();
