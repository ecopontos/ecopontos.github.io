// Persistência local em IndexedDB. Tudo fica no navegador do aparelho —
// não há servidor nem login no MVP. Fotos são guardadas como Blob.

const NOME = 'volumosos-pwa';
const VERSAO = 1;

let dbPromise;

function abrir() {
    dbPromise ??= new Promise((resolve, reject) => {
        const req = indexedDB.open(NOME, VERSAO);
        req.onupgradeneeded = () => {
            const db = req.result;
            db.createObjectStore('regioes', { keyPath: 'id' });
            db.createObjectStore('coletas', { keyPath: 'id' }).createIndex('regiaoId', 'regiaoId');
            db.createObjectStore('agendamentos', { keyPath: 'id' }).createIndex('coletaId', 'coletaId');
            db.createObjectStore('fotos', { keyPath: 'id' }).createIndex('agendamentoId', 'agendamentoId');
            db.createObjectStore('config', { keyPath: 'chave' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}

function promessa(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function store(nome, modo = 'readonly') {
    return (await abrir()).transaction(nome, modo).objectStore(nome);
}

export async function listar(nome) {
    return promessa((await store(nome)).getAll());
}

export async function obter(nome, id) {
    return promessa((await store(nome)).get(id));
}

export async function porIndice(nome, indice, valor) {
    return promessa((await store(nome)).index(indice).getAll(valor));
}

export async function gravar(nome, valor) {
    return promessa((await store(nome, 'readwrite')).put(valor));
}

export async function remover(nome, id) {
    return promessa((await store(nome, 'readwrite')).delete(id));
}

/** Grava o agendamento e substitui suas fotos numa única transação. */
export async function gravarAgendamentoComFotos(agendamento, fotos) {
    const db = await abrir();
    const tx = db.transaction(['agendamentos', 'fotos'], 'readwrite');
    const sFotos = tx.objectStore('fotos');
    const antigas = await promessa(sFotos.index('agendamentoId').getAllKeys(agendamento.id));
    const manter = new Set(fotos.map((f) => f.id));
    antigas.filter((id) => !manter.has(id)).forEach((id) => sFotos.delete(id));
    fotos.forEach((f) => sFotos.put({ ...f, agendamentoId: agendamento.id }));
    tx.objectStore('agendamentos').put(agendamento);
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

export async function lerConfig(chave, padrao = null) {
    const r = await obter('config', chave);
    return r ? r.valor : padrao;
}

export async function gravarConfig(chave, valor) {
    return gravar('config', { chave, valor });
}

function blobParaDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        r.readAsDataURL(blob);
    });
}

/** Backup completo (fotos em base64) para levar a outro aparelho. */
export async function exportar() {
    const fotos = await listar('fotos');
    return {
        app: 'volumosos-pwa',
        versao: VERSAO,
        exportadoEm: new Date().toISOString(),
        regioes: await listar('regioes'),
        coletas: await listar('coletas'),
        agendamentos: await listar('agendamentos'),
        fotos: await Promise.all(fotos.map(async ({ blob, ...resto }) => ({ ...resto, dataUrl: await blobParaDataUrl(blob) }))),
    };
}

/** Importa um backup mesclando por id (registros existentes são sobrescritos). */
export async function importar(backup) {
    if (backup?.app !== 'volumosos-pwa') throw new Error('Arquivo não é um backup deste app');
    for (const nome of ['regioes', 'coletas', 'agendamentos']) {
        for (const item of backup[nome] ?? []) await gravar(nome, item);
    }
    for (const { dataUrl, ...foto } of backup.fotos ?? []) {
        const blob = await (await fetch(dataUrl)).blob();
        await gravar('fotos', { ...foto, blob });
    }
}
