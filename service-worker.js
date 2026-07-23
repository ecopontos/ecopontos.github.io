// Este service worker existe apenas para desativar o antigo PWA que
// costumava rodar na raiz do site e limpar o cache que ele deixou.

self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        const tinhaCacheAntigo = cacheNames.some((nome) => nome.startsWith('ecopontos'));

        await Promise.all(cacheNames.map((nome) => caches.delete(nome)));
        await self.registration.unregister();

        if (tinhaCacheAntigo) {
            const clientesAbertos = await self.clients.matchAll({ type: 'window' });
            clientesAbertos.forEach((cliente) => cliente.navigate(cliente.url));
        }
    })());
});
