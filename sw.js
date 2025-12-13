// Service Worker Mínimo para PWA
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass-through básico (necessário para o Chrome detectar como PWA)
  event.respondWith(fetch(event.request));
});