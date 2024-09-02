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
    if (event.request.mode === 'navigate') {
        // Se for uma navegação, tenta buscar da rede, mas faz fallback para a página offline
        event.respondWith(
            caches.match(event.request).then((response) => {
                if (response) {
                    return response; // Retorna do cache se estiver disponível
                }
                return fetch(event.request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }).catch(() => {
                    // Se a rede falhar, retorna uma página offline
                    return caches.match('/offline.html');
                });
            })
        );
    } else {
        // Para outros pedidos, tenta a rede primeiro e depois o cache
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request).then((networkResponse) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                }).catch(() => {
                    // Fallback para a página offline caso não haja resposta
                    return caches.match('/offline.html');
                });
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
