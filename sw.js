const V = 'sahaya-v2';
const SHELL = ['./', 'index.html', 'admin.html', 'styles.css', 'config.js', 'db.js', 'app.js', 'admin.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first so updates show up immediately; cache is the offline fallback.
// Cross-origin requests (Supabase) are never touched.
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copy = r.clone();
        caches.open(V).then((c) => c.put(e.request, copy));
        return r;
      })
      .catch(() => caches.match(e.request).then((m) => m || caches.match('index.html')))
  );
});
