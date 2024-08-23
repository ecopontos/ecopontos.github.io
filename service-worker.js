// This is the "Offline page" service worker

importScripts('https://storage.googleapis.com/workbox-cdn/releases/5.1.2/workbox-sw.js');

const CACHE_NAME = "ecopontos-v1"; // Inclua a versão do cache aqui

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

                const cache = await caches.open(CACHE_NAME);
                const cachedResp = await cache.match('/offline.html');
                return cachedResp;
            }
        })());
    } else {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
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
