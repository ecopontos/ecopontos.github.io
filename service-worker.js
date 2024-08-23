// This is the "Offline page" service worker

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const CACHE_NAME = "ecopontos-v2"; // Inclua a versão do cache aqui

const URLs_TO_CACHE = [
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

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(URLs_TO_CACHE)
                .then(() => self.skipWaiting())
                .catch((error) => {
                    console.error('Falha ao adicionar ao cache durante a instalação:', error);
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
    if (event.request.mode === 'navigate') {
        event.respondWith(
            (async () => {
                try {
                    // Tenta usar a resposta de pré-carregamento
                    const preloadResp = await event.preloadResponse;
                    if (preloadResp) {
                        return preloadResp;
                    }

                    // Tenta buscar da rede
                    const networkResp = await fetch(event.request);
                    return networkResp;
                } catch (error) {
                    console.error('Erro ao buscar:', error);

                    // Fallback para cache offline
                    const cache = await caches.open(CACHE_NAME);
                    return await cache.match('/offline.html');
                }
            })()
        );
    } else {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            }).catch(() => {
                return caches.match('/offline.html');
            })
        );
    }
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
