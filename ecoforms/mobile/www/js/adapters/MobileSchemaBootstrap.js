/**
 * MobileSchemaBootstrap
 *
 * Cria o schema SQLite do mobile — subset de ensure-columns.ts adaptado para
 * o runtime Capacitor. Idempotente: usa CREATE TABLE IF NOT EXISTS em tudo.
 *
 * Ordem de criação respeita FKs:
 *   perfis → escalas → setores → usuarios
 *   registro_formularios → pacotes → tbl_suite
 *   tarefas → tarefas_eventos
 *   demandas → demanda_eventos
 *   fila_eventos_sync → log_eventos_aplicados
 *
 * ADR-052 — Fase 2
 */

import { sqliteAdapter } from './CapacitorSqliteAdapter.js';

const run = (sql) => sqliteAdapter.execute(sql).catch((e) => {
    console.warn('[MobileSchema]', sql.slice(0, 60), e?.message ?? e);
});

export async function bootstrapMobileSchema() {
    // ── 1. PERFIS / SETORES / ESCALAS (dependências de usuarios) ──────

    await run(`
        CREATE TABLE IF NOT EXISTS perfis (
            id            TEXT PRIMARY KEY,
            nome          TEXT NOT NULL UNIQUE,
            descricao     TEXT,
            ativo         INTEGER NOT NULL DEFAULT 1,
            criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS escalas (
            id                 TEXT PRIMARY KEY,
            nome               TEXT NOT NULL,
            tipo               TEXT NOT NULL,
            referencia_inicio  TEXT NOT NULL,
            duracao_minutos    INTEGER NOT NULL,
            tolerancia_minutos INTEGER NOT NULL DEFAULT 10,
            ciclo_horas        INTEGER NOT NULL,
            criado_em          TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em      TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS setores (
            id            TEXT PRIMARY KEY,
            nome          TEXT NOT NULL,
            descricao     TEXT,
            pai_id        TEXT REFERENCES setores(id),
            ativo         INTEGER NOT NULL DEFAULT 1,
            criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    // ── 2. USUARIOS ────────────────────────────────────────────────────

    await run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id                     TEXT PRIMARY KEY,
            nome_usuario           TEXT NOT NULL,
            hash_senha             TEXT NOT NULL,
            nome                   TEXT NOT NULL,
            perfil                 TEXT NOT NULL,
            email                  TEXT,
            telefone               TEXT,
            ativo                  INTEGER NOT NULL DEFAULT 1,
            setor_principal_id     TEXT,
            escala_id              TEXT,
            id_organizacao         TEXT,
            sal_sync               TEXT,
            formularios_permitidos TEXT DEFAULT '[]',
            criado_em              TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em          TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_nome_usuario ON usuarios(nome_usuario)`);

    await run(`
        CREATE TABLE IF NOT EXISTS usuarios_setores (
            usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            setor_id   TEXT NOT NULL REFERENCES setores(id)  ON DELETE CASCADE,
            PRIMARY KEY (usuario_id, setor_id)
        )
    `);

    // ── 3. FORMULÁRIOS ─────────────────────────────────────────────────

    await run(`
        CREATE TABLE IF NOT EXISTS registro_formularios (
            form_id        TEXT PRIMARY KEY,
            titulo         TEXT,
            slug           TEXT,
            conteudo       TEXT,
            versao         TEXT,
            ativo          INTEGER DEFAULT 1,
            auto_aprovacao INTEGER DEFAULT 0,
            autor          TEXT,
            tipo_form      TEXT,
            data_id        TEXT,
            situacao       TEXT DEFAULT 'draft',
            ad_hoc         INTEGER DEFAULT 0,
            criado_em      TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em  TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS registro_dados (
            id            TEXT PRIMARY KEY,
            tipo          TEXT NOT NULL,
            chave         TEXT NOT NULL,
            conteudo      TEXT,
            versao        INTEGER DEFAULT 1,
            criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    // ── 4. PACOTES (submissões de formulários) ─────────────────────────

    await run(`
        CREATE TABLE IF NOT EXISTS pacotes (
            id                 INTEGER,
            criado_em          TEXT NOT NULL DEFAULT (datetime('now')),
            id_usuario         TEXT NOT NULL DEFAULT '0000000-000-000-000-00000000',
            dados              TEXT NOT NULL,
            tipo_form          TEXT,
            status_sinc        TEXT DEFAULT 'synced',
            ultima_modificacao TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em      TEXT DEFAULT (datetime('now')),
            ativo              INTEGER DEFAULT 1,
            id_atividade       TEXT,
            status             TEXT DEFAULT 'submitted',
            revisor_id         TEXT,
            revisado_em        TEXT,
            motivo_rejeicao    TEXT,
            notas_revisao      TEXT,
            processado_em      TEXT,
            arquivado_em       TEXT,
            prazo_correcao     TEXT,
            id_tarefa          TEXT,
            submitted_at       TEXT,
            id_pacote          TEXT,
            num_versao         INTEGER DEFAULT 1,
            atual              INTEGER DEFAULT 1,
            tipo_modulo        TEXT,
            tipo_recurso       TEXT,
            carga_json         TEXT,
            id_proprietario    TEXT,
            id_entidade        TEXT,
            tipo_entidade      TEXT,
            bloqueado_por      TEXT,
            bloqueado_em       TEXT,
            ref_id_pacote      TEXT,
            ref_versao_pacote  INTEGER,
            fechado_em         TEXT,
            ultimo_id_envelope TEXT,
            ultimo_envelope_em TEXT
        )
    `);
    await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_suite_package_version ON pacotes (id_pacote, num_versao)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_suite_entity ON pacotes (tipo_entidade, id_entidade)`);

    // ── 5. TBL_SUITE ───────────────────────────────────────────────────

    await run(`
        CREATE TABLE IF NOT EXISTS tbl_suite (
            package_id      TEXT PRIMARY KEY,
            version_no      INTEGER NOT NULL DEFAULT 1,
            module_type     TEXT NOT NULL,
            resource_type   TEXT NOT NULL,
            status          TEXT NOT NULL DEFAULT 'draft',
            owner_id        TEXT,
            is_current      INTEGER NOT NULL DEFAULT 1,
            locked_by       TEXT,
            locked_at       TEXT,
            ref_package_id  TEXT,
            ref_package_ver INTEGER,
            payload_json    TEXT NOT NULL DEFAULT '{}',
            created_at      TEXT NOT NULL DEFAULT (datetime('now')),
            closed_at       TEXT
        )
    `);

    // ── 6. TAREFAS ─────────────────────────────────────────────────────

    await run(`
        CREATE TABLE IF NOT EXISTS tarefas (
            id                    TEXT PRIMARY KEY,
            projeto_id            TEXT,
            titulo                TEXT NOT NULL,
            descricao             TEXT,
            status                TEXT DEFAULT 'a_fazer',
            prioridade            TEXT DEFAULT 'media',
            atribuido_para        TEXT,
            criado_por            TEXT NOT NULL,
            prazo                 TEXT,
            prazo_fim             TEXT,
            tipo_prazo            TEXT,
            ordem                 INTEGER DEFAULT 0,
            id_formulario         TEXT,
            suite_id              TEXT,
            etiquetas             TEXT DEFAULT '[]',
            setor_id              TEXT,
            arquivado             INTEGER DEFAULT 0,
            deletado_em           TEXT,
            deletado_por          TEXT,
            tarefa_pai_id         TEXT,
            tarefa_container_id   TEXT,
            id_ciclo              TEXT,
            depende_tarefa_id     TEXT,
            versao_snapshot       TEXT,
            hash_snapshot         TEXT,
            snapshot_congelado_em TEXT,
            localizacao           TEXT,
            carga                 TEXT,
            recorrencia           TEXT,
            demanda_id            TEXT,
            aprovado_por          TEXT,
            origem                TEXT,
            motivo_rejeicao       TEXT,
            slot_id               TEXT,
            agendamento_id        TEXT,
            origem_tipo           TEXT,
            origem_id             TEXT,
            criado_em             TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em         TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await run(`CREATE INDEX IF NOT EXISTS idx_tarefas_demanda    ON tarefas(demanda_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_tarefas_slot       ON tarefas(slot_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_tarefas_agendamento ON tarefas(agendamento_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_tarefas_origem     ON tarefas(origem_tipo, origem_id)`);

    await run(`
        CREATE TABLE IF NOT EXISTS tarefas_eventos (
            id         TEXT PRIMARY KEY,
            tarefa_id  TEXT NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
            tipo       TEXT NOT NULL,
            descricao  TEXT,
            usuario_id TEXT,
            metadata   TEXT DEFAULT '{}',
            criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    // ── 7. DEMANDAS ────────────────────────────────────────────────────

    await run(`
        CREATE TABLE IF NOT EXISTS demandas (
            id                 TEXT PRIMARY KEY,
            origem_tipo        TEXT NOT NULL,
            origem_id          TEXT,
            solicitante_id     TEXT NOT NULL,
            destinatario_id    TEXT NOT NULL,
            tipo_acao          TEXT,
            descricao          TEXT,
            status             TEXT NOT NULL DEFAULT 'aberta',
            politica_conclusao TEXT NOT NULL DEFAULT 'declarado',
            auto_aceite        INTEGER NOT NULL DEFAULT 0,
            aceito_por         TEXT,
            aceito_em          TEXT,
            encerrado_por      TEXT,
            encerrado_em       TEXT,
            arquivada_em       TEXT,
            caminho_arquivo    TEXT,
            status_arquivo     TEXT,
            setor_id           TEXT,
            ultimo_id_envelope   TEXT,
            ultimo_envelope_em   TEXT,
            criado_em          TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em      TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await run(`CREATE INDEX IF NOT EXISTS idx_demandas_setor ON demandas(setor_id)`);

    await run(`
        CREATE TABLE IF NOT EXISTS demanda_eventos (
            id             TEXT PRIMARY KEY,
            demanda_id     TEXT NOT NULL REFERENCES demandas(id),
            tipo           TEXT NOT NULL,
            correlation_id TEXT,
            causation_id   TEXT,
            carga          TEXT NOT NULL,
            id_dispositivo TEXT,
            id_usuario     TEXT,
            criado_em      TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    // ── 8. SYNC ────────────────────────────────────────────────────────

    await run(`
        CREATE TABLE IF NOT EXISTS fila_eventos_sync (
            id             TEXT PRIMARY KEY,
            tipo           TEXT NOT NULL,
            carga          TEXT NOT NULL,
            tipo_agregado  TEXT,
            id_agregado    TEXT,
            id_correlacao  TEXT,
            id_causa       TEXT,
            sequencia      INTEGER,
            situacao       TEXT NOT NULL DEFAULT 'pending'
                               CHECK(situacao IN ('pending','sent','failed')),
            tentativas     INTEGER NOT NULL DEFAULT 0,
            id_envelope    TEXT,
            dominio        TEXT,
            id_entidade    TEXT,
            caminho_storage TEXT,
            criado_em      TEXT NOT NULL DEFAULT (datetime('now')),
            enviado_em     TEXT
        )
    `);
    await run(`CREATE INDEX IF NOT EXISTS idx_sync_event_queue_status ON fila_eventos_sync(situacao)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_sync_event_queue_entity ON fila_eventos_sync(tipo_agregado, id_agregado)`);

    await run(`
        CREATE TABLE IF NOT EXISTS log_eventos_aplicados (
            envelope_id        TEXT PRIMARY KEY,
            tipo_entidade      TEXT NOT NULL,
            id_entidade        TEXT NOT NULL,
            caminho_storage    TEXT NOT NULL,
            dispositivo_origem TEXT,
            usuario_origem     TEXT,
            aplicado_em        TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await run(`CREATE INDEX IF NOT EXISTS idx_sync_applied_log_entity ON log_eventos_aplicados(tipo_entidade, id_entidade)`);

    await run(`
        CREATE TABLE IF NOT EXISTS sync_device_log (
            id         TEXT PRIMARY KEY,
            device_id  TEXT NOT NULL,
            seq        INTEGER NOT NULL,
            event_id   TEXT NOT NULL,
            acked      INTEGER NOT NULL DEFAULT 0,
            pushed_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await run(`CREATE INDEX IF NOT EXISTS idx_sync_device_log_device ON sync_device_log(device_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_sync_device_log_event  ON sync_device_log(event_id)`);

    await run(`
        CREATE TABLE IF NOT EXISTS log_gaps_sync (
            id          TEXT PRIMARY KEY,
            id_roteamento  TEXT NOT NULL,
            sequencia_faltante INTEGER NOT NULL,
            situacao      TEXT NOT NULL DEFAULT 'pending'
                            CHECK(situacao IN ('pending','resolved','skipped')),
            tentativas    INTEGER NOT NULL DEFAULT 0,
            resolvido_em TEXT,
            detectado_em TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(id_roteamento, sequencia_faltante)
        )
    `);
    await run(`CREATE INDEX IF NOT EXISTS idx_sync_gap_log_routing ON log_gaps_sync(id_roteamento)`);

    console.log('[MobileSchema] bootstrap concluído');
}
