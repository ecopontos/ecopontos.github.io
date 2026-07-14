// This is the "Offline page" service worker

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const CACHE_NAME = "ecopontos-v4-20260714";

const URLs_TO_CACHE = [
    '/ecoponto/',
    '/ecoponto/index.html',
    '/ecoponto/configuracao.html',
    '/ecoponto/registros.html',
    '/ecoponto/script.js',
    '/ecoponto/registros.js',
    '/ecoponto/notificacoes.js',
    '/ecoponto/configuracao.js',
    '/ecoponto/logotipo.png',
    '/ecoponto/offline.html',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(URLs_TO_CACHE)
                .then(() => {
                    // Indica que o service worker pode pular o estado de espera
                    self.skipWaiting();
                    console.log('Todos os recursos foram adicionados ao cache com sucesso.');
                })
                .catch((error) => {
                    // Loga um erro caso ocorra algum problema ao adicionar recursos ao cache
                    console.error('Falha ao adicionar ao cache:', error);
                });
        })
    );
});

self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheWhitelist.includes(cacheName)) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

if (workbox.navigationPreload.isSupported()) {
    workbox.navigationPreload.enable();
}

self.addEventListener('fetch', (event) => {
    // POSTs para o Apps Script não podem ser gravados no Cache API.
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request).then((networkResponse) => {
            const mesmaOrigem = new URL(event.request.url).origin === self.location.origin;
            if (mesmaOrigem && networkResponse.ok) {
                const copia = networkResponse.clone();
                return caches.open(CACHE_NAME)
                    .then((cache) => cache.put(event.request, copia))
                    .catch(() => undefined)
                    .then(() => networkResponse);
            }
            return networkResponse;
        }).catch(() => {
            return caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                if (event.request.mode === 'navigate') {
                    return caches.match('/ecoponto/offline.html');
                }
                return Response.error();
            });
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'NEW_VERSION_AVAILABLE') {
        self.registration.showNotification('Nova versão disponível', {
            body: 'Clique para atualizar',
            actions: [{ action: 'update', title: 'Atualizar' }]
        });
    }
});
