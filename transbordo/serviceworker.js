// Nome do cache
const CACHE_NAME = 'transbordo-v1';

// Arquivos a serem armazenados em cache
const urlsToCache = [
  '/transbordo/',
  '/transbordo/logo.png',
  '/transbordo/offline.html'
];

// Instalação do Service Worker
self.addEventListener('install', function(event) {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Intercepta as solicitações e serve o conteúdo em cache, se disponível
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit - return response
        if (response) {
          return response;
        }
        // Não encontrou no cache - busca na rede
        return fetch(event.request);
      })
      .catch(function(error) {
        // Se falhar, retorna a página offline
        return caches.match('/transbordo/offline.html');
      })
  );
});

// Atualiza o cache quando o Service Worker é ativado
self.addEventListener('activate', function(event) {

  var cacheWhitelist = ['transbordo-v1'];

  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
