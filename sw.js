// Kladde – Offline-Speicher. Bei jeder Änderung an der App VERSION hochzählen.
const VERSION = 'kladde-v9';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './fonts/bricolage-grotesque-latin-standard-normal.woff2', './fonts/bricolage-grotesque-latin-ext-standard-normal.woff2',
  './fonts/newsreader-latin-standard-normal.woff2', './fonts/newsreader-latin-ext-standard-normal.woff2'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // Seite: erst Netz (für Updates), sonst Offline-Kopie. Rest: Offline-Kopie zuerst.
  if (e.request.mode === 'navigate') {
    // Seite: erst Netz (für Updates). Nur eine funktionierende Seite wird gespeichert;
    // bei Fehler (offline, 404, GitHub-Störung) kommt die gespeicherte App.
    e.respondWith(
      fetch(e.request).then(r => {
        if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put('./index.html', c)); return r; }
        return caches.match('./index.html').then(cached => cached || r);
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
    if (res.ok) { const c = res.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); }
    return res;
  })));
});
