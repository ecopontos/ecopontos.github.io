// Service worker: cache do "app shell" para funcionar offline.
// Ao alterar qualquer arquivo listado, incremente VERSAO para forçar a atualização.
const VERSAO = 'volumosos-v3';
const ARQUIVOS = [
    './',
    './index.html',
    './styles.css',
    './manifest.webmanifest',
    './icon.svg',
    './js/app.js',
    './js/cep.js',
    './js/db.js',
    './js/drive.js',
    './js/form-volumosos.js',
    './js/fotos.js',
    './js/id.js',
    './js/regras.js',
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
            .then(() => self.clients.claim()),
    );
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    // Só o próprio app; chamadas ao Apps Script e wa.me vão direto para a rede.
    if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
    // Outros apps do mesmo domínio (ex.: ecopontos.github.io/ecoponto/) apagam
    // caches que não são deles. Por isso todo arquivo buscado na rede volta para
    // o cache: o app se recompõe sozinho na primeira abertura online.
    e.respondWith((async () => {
        const cache = await caches.open(VERSAO);
        const salvo = await cache.match(e.request, { ignoreSearch: true });
        if (salvo) return salvo;
        const resp = await fetch(e.request);
        if (resp.ok) cache.put(e.request, resp.clone()).catch(() => {});
        return resp;
    })());
});
