// Service Worker Mínimo para PWA
self.addEventListener('install', (event) => {
  // Força o SW a se tornar ativo imediatamente
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Garante que o SW controle todas as abas abertas imediatamente
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through básico (necessário para o Chrome detectar como PWA)
  event.respondWith(fetch(event.request));
});