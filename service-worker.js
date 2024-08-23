// This is the "Offline page" service worker

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const CACHE = "ecopontos";

// Arquivos a serem armazenados em cache
const URLsToCache = [
    '/',
    '/index.html',
    '/configuracao.html',
    '/registros.html',
    '/script.js',
    '/registros.js',
    '/notificacoes.js',
    '/configuracao.js',
    '/logotipo.png',
    '/offline.html',
    
    // Adicione outros recursos que deseja armazenar em cache
];

// TODO: replace the following with the correct offline fallback page i.e.: const offlineFallbackPage = "offline.html";
const offlineFallbackPage = "offline.html";

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(URLsToCache)
        .then(() => self.skipWaiting())
        .catch((error) => {
          console.error('Falha ao adicionar ao cache durante a instalação:', error);
        });
    })
  );
});

if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preloadResp = await event.preloadResponse;
        if (preloadResp) {
          return preloadResp;
        }

        const networkResp = await fetch(event.request);
        return networkResp;
      } catch (error) {
        console.error('Erro ao buscar:', error);

        const cache = await caches.open(CACHE);
        const cachedResp = await cache.match(offlineFallbackPage);
        return cachedResp;
      }
    })());
  } else {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cachedResp = await cache.match(event.request);
      if (cachedResp) {
        return cachedResp;
      }

      try {
        const networkResp = await fetch(event.request);
        cache.put(event.request, networkResp.clone());
        return networkResp;
      } catch (error) {
        console.error('Erro ao buscar:', error);
        return new Response('Recurso não disponível offline.');
      }
    })());
  }
});
