/**
 * IndexedDbMigration
 *
 * Migração one-shot: lê dados do IndexedDB (SyncEventDB + FormStore) e
 * insere no SQLite via CapacitorSqliteAdapter. Executado uma única vez no
 * primeiro boot após atualização do APK que inclui o ADR-052.
 *
 * Estratégia: upsert (INSERT OR IGNORE) — seguro para re-execução acidental.
 * Marca conclusão em localStorage('idb_migration_v1') para não re-executar.
 *
 * ADR-052 — Fase 2
 */

import { sqliteAdapter } from './CapacitorSqliteAdapter.js';

const MIGRATION_KEY = 'idb_migration_v1';

export function isMigrationNeeded() {
    return !localStorage.getItem(MIGRATION_KEY);
}

/**
 * Abre o IndexedDB legacy (SyncEventDB) e retorna todos os registros
 * de um object store como array.
 */
function readAllFromStore(dbName, storeName, version = 1) {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, version);
        req.onerror = () => resolve([]); // DB não existe — ok
        req.onsuccess = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.close();
                return resolve([]);
            }
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const getAll = store.getAll();
            getAll.onsuccess = () => { db.close(); resolve(getAll.result ?? []); };
            getAll.onerror = () => { db.close(); resolve([]); };
        };
    });
}

/**
 * Executa a migração completa. Seguro chamar mesmo se não há dados.
 * Lança erro somente em falha crítica de escrita no SQLite.
 */
export async function runMigration() {
    if (!isMigrationNeeded()) return;

    console.log('[Migration] Iniciando migração IndexedDB → SQLite...');

    await sqliteAdapter.transaction(async () => {
        // ── fila_eventos_sync ─────────────────────────────────────────
        const syncEvents = await readAllFromStore('SyncEventDB', 'syncEventQueue');
        for (const ev of syncEvents) {
            await sqliteAdapter.execute(
                `INSERT OR IGNORE INTO fila_eventos_sync
                 (id, tipo, carga, tipo_agregado, id_agregado, situacao, tentativas, criado_em)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    ev.id ?? ev.envelopeId ?? String(Date.now()),
                    ev.type ?? ev.tipo ?? 'unknown',
                    typeof ev.payload === 'string' ? ev.payload : JSON.stringify(ev.payload ?? ev.carga ?? {}),
                    ev.aggregateType ?? ev.tipo_agregado ?? null,
                    ev.aggregateId   ?? ev.id_agregado   ?? null,
                    ev.status ?? ev.situacao ?? 'pending',
                    ev.retries ?? ev.tentativas ?? 0,
                    ev.createdAt ?? ev.criado_em ?? new Date().toISOString(),
                ]
            );
        }
        console.log(`[Migration] fila_eventos_sync: ${syncEvents.length} registros`);

        // ── usuarios (cache local do mobile) ─────────────────────────
        const usuarios = await readAllFromStore('SyncEventDB', 'usuarios');
        for (const u of usuarios) {
            await sqliteAdapter.execute(
                `INSERT OR IGNORE INTO usuarios
                 (id, nome_usuario, hash_senha, nome, perfil, email, ativo,
                  formularios_permitidos, criado_em, atualizado_em)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    u.id,
                    u.nome_usuario ?? u.username ?? '',
                    u.hash_senha ?? u.password_hash ?? '',
                    u.nome ?? u.name ?? '',
                    u.perfil ?? u.role ?? 'campo',
                    u.email ?? null,
                    u.ativo ?? 1,
                    JSON.stringify(u.formularios_permitidos ?? u.allowedForms ?? []),
                    u.criado_em ?? u.createdAt ?? new Date().toISOString(),
                    u.atualizado_em ?? u.updatedAt ?? new Date().toISOString(),
                ]
            );
        }
        console.log(`[Migration] usuarios: ${usuarios.length} registros`);

        // ── tarefas ───────────────────────────────────────────────────
        const tarefas = await readAllFromStore('SyncEventDB', 'tarefas');
        for (const t of tarefas) {
            await sqliteAdapter.execute(
                `INSERT OR IGNORE INTO tarefas
                 (id, titulo, status, atribuido_para, criado_por, prazo,
                  carga, origem, criado_em, atualizado_em)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    t.id,
                    t.titulo ?? t.title ?? '',
                    t.status ?? 'a_fazer',
                    t.atribuido_para ?? t.assignedTo ?? null,
                    t.criado_por ?? t.createdBy ?? 'system',
                    t.prazo ?? t.dueDate ?? null,
                    typeof t.carga === 'string' ? t.carga : JSON.stringify(t.carga ?? {}),
                    t.origem ?? null,
                    t.criado_em ?? t.createdAt ?? new Date().toISOString(),
                    t.atualizado_em ?? t.updatedAt ?? new Date().toISOString(),
                ]
            );
        }
        console.log(`[Migration] tarefas: ${tarefas.length} registros`);

        // ── pacotes (FormStore sql.js → SQLite) ───────────────────────
        // FormStore usa sql.js (SQLite WASM), não IndexedDB — lemos via
        // readAllFromStore no store local que ele mantém em IDB como backup.
        const formData = await readAllFromStore('SyncEventDB', 'suite');
        for (const p of formData) {
            await sqliteAdapter.execute(
                `INSERT OR IGNORE INTO pacotes
                 (id_pacote, id_usuario, dados, tipo_form, status_sinc,
                  status, criado_em, atualizado_em)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    p.id ?? p.packageId ?? p.id_pacote,
                    p.userId ?? p.id_usuario ?? '0000000-000-000-000-00000000',
                    typeof p.dados === 'string' ? p.dados : JSON.stringify(p.dados ?? p.payload ?? {}),
                    p.tipo_form ?? p.formType ?? null,
                    p.status_sinc ?? 'pending',
                    p.status ?? 'submitted',
                    p.criado_em ?? p.createdAt ?? new Date().toISOString(),
                    p.atualizado_em ?? p.updatedAt ?? new Date().toISOString(),
                ]
            );
        }
        console.log(`[Migration] pacotes: ${formData.length} registros`);
    });

    localStorage.setItem(MIGRATION_KEY, new Date().toISOString());
    console.log('[Migration] Concluída. IndexedDB preservado — remover manualmente após validação.');
}
