// Offline support: network-first, falling back to the cache when offline.
const CACHE = 'rootwell-v12';
const FILES = ['./', './index.html', './art.js', './data.js', './game.js', './world3d.js', './lib/three.module.min.js', './lib/GLTFLoader.js', './lib/SkeletonUtils.js', './lib/BufferGeometryUtils.js', './lib/meshopt_decoder.module.js', './fonts/pixelify.woff2', './assets/meta.json', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || Response.error()))
  );
});
