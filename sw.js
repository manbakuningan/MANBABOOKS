const CACHE_NAME = 'manba-books-cache-v2';
// Hanya precache aset lokal yang pasti ada di scope yang sama. Aset CDN
// (Tailwind, Chart.js, html5-qrcode) sengaja TIDAK diprecache di sini —
// sebelumnya semuanya dimasukkan lewat cache.addAll(), dan kalau satu saja
// gagal di-fetch (mis. CORS atau limit jaringan), seluruh instalasi Service
// Worker gagal (event 'install' reject), bukan cuma aset itu yang batal.
// Aset CDN tetap ikut ter-cache secara "opportunistic" lewat fetch handler
// di bawah begitu berhasil diambil saat runtime.
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Simpan tiap aset secara independen supaya satu kegagalan tidak
        // membatalkan instalasi Service Worker secara keseluruhan.
        return Promise.allSettled(
          urlsToCache.map(url => cache.add(url).catch(err => console.log('Gagal cache:', url, err)))
        );
      })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  // Jangan cache request ke domain lain (API Apps Script) supaya data
  // selalu segar dari server. Hanya cache aset lokal (HTML, JS, CSS).
  if (!event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({ status: "error", message: "Tidak ada koneksi internet" }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(
          response => {
            if (!response || response.status !== 200) {
              return response;
            }
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          }
        );
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});
