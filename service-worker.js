// service-worker.js

const CACHE_NAME = 'meu-pwa-cache-v1';
const urlsToCache = [
    '/ecopontos/',
    '/offline.html' // Uma página offline customizada
];

self.addEventListener('install', function(event) {
    // Instala o cache com os recursos necessários
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(function(cache) {
            console.log('Cache aberto');
            return cache.addAll(urlsToCache);
        })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
        .then(function(response) {
            // Retorna a resposta do cache, se disponível
            if (response) {
                return response;
            }

            // Senão, faz uma solicitação de rede
            return fetch(event.request)
            .catch(function() {
                // Se falhar, retorna a página offline customizada
                return caches.match('/offline.html');
            });
        })
    );
});
