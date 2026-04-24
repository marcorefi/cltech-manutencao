// GestorPrev - Service Worker (offline + cache)
// Versão 1.0

const CACHE_VERSION = 'gestorprev-v1-2026-04-24';
const STATIC_ASSETS = [
  './',
  './index.html',
  './supervisor.html',
  './campo.html',
  './cliente.html',
  './dashboard.html',
  './assets/css/style.css',
  './assets/js/config.js',
  './assets/js/api.js',
  './assets/js/auth.js',
  './assets/js/utils.js',
  './assets/js/offline.js',
  './assets/img/cltech-shield.png',
  './assets/img/cltech-horizontal.png',
  './assets/img/cltech-vertical.png',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
];

// Install: pré-cacheia tudo
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Falha parcial no cache inicial', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: limpa caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: estratégia por tipo de recurso
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Não interceptar API do Apps Script (sempre tenta rede; falha é tratada no api.js)
  if (url.hostname === 'script.google.com' || url.hostname === 'script.googleusercontent.com') {
    return;
  }

  // Assets estáticos: cache-first com update em background
  if (req.method === 'GET' && (
      url.origin === self.location.origin ||
      url.hostname === 'cdn.jsdelivr.net')) {
    event.respondWith(cacheFirst(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(req);
  if (cached) {
    // Update em background (stale-while-revalidate)
    fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
    }).catch(() => {});
    return cached;
  }
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return new Response('Offline e sem cache disponível', { status: 503 });
  }
}
