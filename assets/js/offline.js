// GestorPrev - Fila offline (IndexedDB) + sincronização
// Uso:
//   await Offline.init()
//   Offline.enqueue(action, payload) — se offline ou falha de rede
//   Offline.sync() — processa fila quando online
//   Offline.pendingCount() — quantos na fila

window.Offline = (function() {
  const DB_NAME = 'cltech-offline';
  const DB_VERSION = 1;
  const STORE = 'fila';
  let db = null;
  let syncing = false;
  const listeners = [];

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function init() {
    if (!('indexedDB' in window)) return false;
    db = await openDB();
    window.addEventListener('online', () => sync());
    if (navigator.onLine) setTimeout(sync, 1500);
    return true;
  }

  function tx(mode) {
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  function enqueue(action, payload) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('IDB não inicializado'));
      const item = { action, payload, createdAt: new Date().toISOString(), attempts: 0 };
      const req = tx('readwrite').add(item);
      req.onsuccess = () => { notify(); resolve(req.result); };
      req.onerror = () => reject(req.error);
    });
  }

  function listAll() {
    return new Promise((resolve, reject) => {
      if (!db) return resolve([]);
      const req = tx('readonly').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function remove(id) {
    return new Promise((resolve) => {
      const req = tx('readwrite').delete(id);
      req.onsuccess = () => { notify(); resolve(); };
      req.onerror = () => resolve();
    });
  }

  function updateAttempts(id, attempts) {
    return new Promise((resolve) => {
      const store = tx('readwrite');
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const item = getReq.result;
        if (!item) return resolve();
        item.attempts = attempts;
        item.lastError = 'retry';
        const put = store.put(item);
        put.onsuccess = () => resolve();
        put.onerror = () => resolve();
      };
      getReq.onerror = () => resolve();
    });
  }

  async function pendingCount() {
    const all = await listAll();
    return all.length;
  }

  async function sync() {
    if (syncing || !db || !navigator.onLine) return;
    if (!window.API) return;
    syncing = true;
    try {
      const items = await listAll();
      for (const item of items) {
        if (item.attempts >= 5) continue; // desistiu após 5 tentativas
        try {
          const res = await window.API.call(item.action, item.payload);
          if (res && res.ok) {
            await remove(item.id);
          } else {
            await updateAttempts(item.id, (item.attempts || 0) + 1);
          }
        } catch (e) {
          await updateAttempts(item.id, (item.attempts || 0) + 1);
          break; // rede caiu de novo
        }
      }
    } finally {
      syncing = false;
      notify();
    }
  }

  function onChange(cb) { listeners.push(cb); }
  function notify() { listeners.forEach(cb => { try { cb(); } catch (e) {} }); }

  function statusBadge() {
    const wrapId = 'offlineStatus';
    let el = document.getElementById(wrapId);
    if (!el) {
      el = document.createElement('div');
      el.id = wrapId;
      el.style.cssText = 'position:fixed;bottom:12px;right:12px;padding:8px 14px;border-radius:20px;font-size:12px;font-weight:600;z-index:999;box-shadow:0 2px 8px rgba(0,0,0,0.2);display:none';
      document.body.appendChild(el);
    }
    return el;
  }

  async function updateBadge() {
    const el = statusBadge();
    const count = await pendingCount();
    if (!navigator.onLine) {
      el.style.display = 'block';
      el.style.background = '#E67E22';
      el.style.color = '#fff';
      el.textContent = 'Offline' + (count ? ` · ${count} pendente${count > 1 ? 's' : ''}` : '');
    } else if (count > 0) {
      el.style.display = 'block';
      el.style.background = '#2E86C1';
      el.style.color = '#fff';
      el.textContent = `Sincronizando ${count}…`;
    } else {
      el.style.display = 'none';
    }
  }

  window.addEventListener('online', updateBadge);
  window.addEventListener('offline', updateBadge);
  onChange(updateBadge);

  return { init, enqueue, listAll, sync, pendingCount, onChange, updateBadge };
})();
