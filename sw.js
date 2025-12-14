// Service Worker Robusto - v4
const CACHE_NAME = 'adma-bible-v4';
const OFFLINE_URL = 'index.html';

// Arquivos essenciais para o App Shell (estrutura básica)
const PRECACHE_ASSETS = [
  './',
  'index.html',
  'icon.svg',
  'manifest.json?v=3'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Estratégia: Network First (Tenta rede, se falhar, vai pro cache)
  // Isso evita que o app fique preso numa versão velha ou quebrada
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.open(CACHE_NAME)
            .then((cache) => {
              // Se estiver offline e tentar navegar, retorna a página inicial cacheada
              return cache.match(OFFLINE_URL) || cache.match('./');
            });
        })
    );
    return;
  }

  // Para outros recursos (JS, CSS, Imagens), tenta cache primeiro, depois rede
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});