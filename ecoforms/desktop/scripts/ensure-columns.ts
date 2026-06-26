/**
 * Database bootstrap: cria todas as tabelas, índices, views e seeds.
 * Idempotente — usa CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.
 * Banco novo — sem shims de ALTER TABLE para dados legados.
 *
 * Ordem de criação respeita dependências de FK:
 *   perfis → hierarquia_perfis, permissoes
 *   setores → usuarios (setor_principal_id)
 *   usuarios, setores → usuarios_setores
 *   clientes, roteiros, execucao_coleta → execucao_clientes
 *   execucao_clientes → anexos (FK formal)
 */

type QueryFn = <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>;
type ExecuteFn = (sql: string, params?: unknown[], options?: { bootstrap?: boolean }) => Promise<void>;

async function ensureModuleTables(execute: ExecuteFn): Promise<void> {
    await execute(`
        CREATE TABLE IF NOT EXISTS registro_modulos (
            id            TEXT PRIMARY KEY,
            slug          TEXT NOT NULL UNIQUE,
            nome          TEXT NOT NULL,
            descricao   TEXT,
            tipo_entidade   TEXT NOT NULL,
            icon          TEXT,
            color         TEXT,
            prefix        TEXT NOT NULL DEFAULT '',
            ordem         INTEGER NOT NULL DEFAULT 0,
            status        TEXT NOT NULL DEFAULT 'draft'
                              CHECK(status IN ('draft','published','archived')),
            versao       INTEGER NOT NULL DEFAULT 1,
            configuracao        TEXT NOT NULL DEFAULT '{}',
            config_suite  TEXT,
            criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
            publicado_em  TEXT
        )
    `);

    await execute(`
        CREATE TABLE IF NOT EXISTS permissoes_modulos (
            module_id   TEXT NOT NULL REFERENCES registro_modulos(id) ON DELETE CASCADE,
            profile     TEXT NOT NULL,
            can_view    INTEGER NOT NULL DEFAULT 0,
            can_create  INTEGER NOT NULL DEFAULT 0,
            can_edit    INTEGER NOT NULL DEFAULT 0,
            can_approve INTEGER NOT NULL DEFAULT 0,
            can_delete  INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (module_id, profile)
        )
    `);

    await execute(`
        CREATE TABLE IF NOT EXISTS visuais_modulos (
            id             TEXT PRIMARY KEY,
            module_id      TEXT NOT NULL REFERENCES registro_modulos(id) ON DELETE CASCADE,
            visual_type    TEXT NOT NULL
                               CHECK(visual_type IN ('table','chart','kanban','timeline','summary')),
            name           TEXT NOT NULL,
            config         TEXT NOT NULL DEFAULT '{}',
            is_default     INTEGER NOT NULL DEFAULT 0,
            user_id        TEXT,
            parent_view_id TEXT REFERENCES visuais_modulos(id) ON DELETE SET NULL,
            sync_status    TEXT DEFAULT 'synced'
                               CHECK(sync_status IN ('synced','outdated','conflict')),
            position       INTEGER NOT NULL DEFAULT 0,
            criado_em      TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em  TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(module_id, visual_type, name, user_id)
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_mvv_module ON visuais_modulos(module_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_mvv_parent ON visuais_modulos(parent_view_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_mvv_user   ON visuais_modulos(user_id)`);
}

export async function ensureColumns(query: QueryFn, execute: ExecuteFn): Promise<void> {

    // ================================================================
    // 1. RBAC — perfis, hierarquia, permissões, setores, usuários
    // ================================================================

    await execute(`
        CREATE TABLE IF NOT EXISTS perfis (
            id            TEXT PRIMARY KEY,
            nome          TEXT NOT NULL UNIQUE,
            descricao     TEXT,
            ativo         INTEGER NOT NULL DEFAULT 1,
            criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    await execute(`
        INSERT OR IGNORE INTO perfis (id, nome, descricao) VALUES
            ('admin',        'admin',        'Administrador — acesso total'),
            ('gerente',      'gerente',      'Gerente — acesso a coordenadores e abaixo'),
            ('coordenador',  'coordenador',  'Coordenador — acesso a encarregados e abaixo'),
            ('encarregado',  'encarregado',  'Encarregado — acesso a operadores'),
            ('operador',     'operador',     'Operador — apenas próprios dados'),
            ('campo',        'campo',        'Campo — mesmo nível que operador')
    `);

    await execute(`
        CREATE TABLE IF NOT EXISTS hierarquia_perfis (
            perfil    TEXT PRIMARY KEY REFERENCES perfis(id),
            nivel     INTEGER NOT NULL,
            descricao TEXT
        )
    `);

    await execute(`
        INSERT OR IGNORE INTO hierarquia_perfis (perfil, nivel, descricao) VALUES
            ('admin',       0, 'Administrador'),
            ('gerente',     1, 'Gerente'),
            ('coordenador', 2, 'Coordenador'),
            ('encarregado', 3, 'Encarregado'),
            ('operador',    4, 'Operador'),
            ('campo',       4, 'Campo')
    `);

    await execute(`
        CREATE TABLE IF NOT EXISTS permissoes (
            perfil    TEXT NOT NULL REFERENCES perfis(id),
            permissao TEXT NOT NULL,
            descricao TEXT,
            PRIMARY KEY (perfil, permissao)
        )
    `);

    // ADR-037: escalas ANTES de setores e usuarios — FK escala_id
    await execute(`
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

    // setores ANTES de usuarios — FK setor_principal_id (ADR-004)
    await execute(`
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
    await execute(`ALTER TABLE setores ADD COLUMN ativo         INTEGER NOT NULL DEFAULT 1`).catch(() => {});
    await execute(`ALTER TABLE setores ADD COLUMN descricao     TEXT`).catch(() => {});
    await execute(`ALTER TABLE setores ADD COLUMN pai_id        TEXT`).catch(() => {});
    await execute(`ALTER TABLE setores ADD COLUMN atualizado_em TEXT`).catch(() => {});

    await execute(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id                    TEXT PRIMARY KEY,
            nome_usuario              TEXT NOT NULL,
            hash_senha         TEXT NOT NULL,
            nome                  TEXT NOT NULL,
            perfil                TEXT NOT NULL REFERENCES perfis(id),
            email                 TEXT,
            telefone              TEXT,
            ativo                 INTEGER NOT NULL DEFAULT 1,
            setor_principal_id    TEXT REFERENCES setores(id),
            escala_id             TEXT REFERENCES escalas(id),
            id_organizacao                TEXT,
            sal_sync             TEXT,
            formularios_permitidos TEXT DEFAULT '[]',
            criado_em             TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em         TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_nome_usuario ON usuarios(nome_usuario)`);

    // ADR-004: FK com ON DELETE CASCADE em tabela de junção
    await execute(`
        CREATE TABLE IF NOT EXISTS usuarios_setores (
            usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            setor_id   TEXT NOT NULL REFERENCES setores(id)  ON DELETE CASCADE,
            PRIMARY KEY (usuario_id, setor_id)
        )
    `);

    await execute(`
        CREATE TABLE IF NOT EXISTS mapeamento_usuarios_supabase (
            local_id    TEXT PRIMARY KEY REFERENCES usuarios(id),
            id_supabase TEXT NOT NULL UNIQUE,
            criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_supabase_user_map_sid ON mapeamento_usuarios_supabase(id_supabase)`);

    // ================================================================
    // 2. CATÁLOGOS DE OUVIDORIA
    // ================================================================

    await execute(`
        CREATE TABLE IF NOT EXISTS tipos_manifestacao (
            id                 TEXT PRIMARY KEY,
            nome               TEXT NOT NULL,
            descricao          TEXT,
            prazo_dias_corridos INTEGER NOT NULL DEFAULT 30,
            prazo_urgente_dias  INTEGER,
            ativo              INTEGER NOT NULL DEFAULT 1,
            criado_em          TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    // ADR-013: migração aditiva
    await execute(`ALTER TABLE tipos_manifestacao ADD COLUMN prazo_dias_corridos INTEGER NOT NULL DEFAULT 30`).catch(() => {});
    await execute(`ALTER TABLE tipos_manifestacao ADD COLUMN prazo_urgente_dias INTEGER`).catch(() => {});

    await execute(`
        CREATE TABLE IF NOT EXISTS situacoes (
            id        TEXT PRIMARY KEY,
            nome      TEXT NOT NULL,
            descricao TEXT,
            ativo     INTEGER NOT NULL DEFAULT 1,
            criado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    await execute(`
        CREATE TABLE IF NOT EXISTS origens (
            id        TEXT PRIMARY KEY,
            nome      TEXT NOT NULL,
            descricao TEXT,
            ativo     INTEGER NOT NULL DEFAULT 1,
            criado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    // classificacoes: categorias de ocorrências (hierárquicas) — NÃO são prioridades
    await execute(`
        CREATE TABLE IF NOT EXISTS classificacoes (
            id        TEXT PRIMARY KEY,
            nome      TEXT NOT NULL,
            descricao TEXT,
            pai_id    TEXT REFERENCES classificacoes(id),
            ativo     INTEGER NOT NULL DEFAULT 1,
            criado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    // ================================================================
    // 3. CLIENTES
    // ================================================================

    await execute(`
        CREATE TABLE IF NOT EXISTS clientes (
            id                            TEXT PRIMARY KEY,
            tipo                          TEXT NOT NULL CHECK(tipo IN ('PF','PJ')),
            nome                          TEXT NOT NULL,
            documento                     TEXT UNIQUE,
            email                         TEXT,
            telefone                      TEXT,
            cep                           TEXT,
            endereco                      TEXT,
            numero                        TEXT,
            bairro                        TEXT,
            cidade                        TEXT,
            estado                        TEXT,
            complemento                   TEXT,
            ponto_referencia              TEXT,
            latitude                      REAL,
            longitude                     REAL,
            elegivel_coleta_porta_a_porta INTEGER NOT NULL DEFAULT 0,
            ativo                         INTEGER NOT NULL DEFAULT 1,
            criado_em                     TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em                 TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_clientes_nome      ON clientes(nome)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_clientes_documento ON clientes(documento)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_clientes_tipo      ON clientes(tipo)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_clientes_elegivel  ON clientes(elegivel_coleta_porta_a_porta)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_clientes_geo       ON clientes(latitude, longitude)`);
    // migração: renomeia logradouro → endereco em bancos legados
    await execute(`ALTER TABLE clientes ADD COLUMN endereco TEXT`).catch(() => {});
    // migração: adiciona pj_id para vincular PF como contato de PJ
    await execute(`ALTER TABLE clientes ADD COLUMN pj_id TEXT REFERENCES clientes(id)`).catch(() => {});
    // migração: adiciona categoria para classificar tipo de pessoa/entidade
    await execute(`ALTER TABLE clientes ADD COLUMN categoria TEXT`).catch(() => {});
    // migração: adiciona observacoes para notas livres sobre o cliente
    await execute(`ALTER TABLE clientes ADD COLUMN observacoes TEXT`).catch(() => {});
    // migração: adiciona territorial (ID do imóvel cadastrado na prefeitura)
    await execute(`ALTER TABLE clientes ADD COLUMN territorial TEXT`).catch(() => {});
    // (migração de solicitante_* em manifestacoes movida para após CREATE TABLE manifestacoes)

    await execute(`
        CREATE TABLE IF NOT EXISTS cliente_pj_vinculo (
            id         TEXT PRIMARY KEY,
            pf_id      TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
            pj_id      TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
            funcao     TEXT,
            principal  INTEGER NOT NULL DEFAULT 0,
            criado_em  TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(pf_id, pj_id)
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_cliente_pj_vinculo_pf ON cliente_pj_vinculo(pf_id)`).catch(() => {});
    await execute(`CREATE INDEX IF NOT EXISTS idx_cliente_pj_vinculo_pj ON cliente_pj_vinculo(pj_id)`).catch(() => {});
    await execute(`CREATE INDEX IF NOT EXISTS idx_cliente_pj_vinculo_pf_pj ON cliente_pj_vinculo(pf_id, pj_id)`).catch(() => {});

    await execute(`
        CREATE TABLE IF NOT EXISTS cliente_contatos (
            id         TEXT PRIMARY KEY,
            cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
            nome       TEXT,
            cargo      TEXT,
            telefone   TEXT,
            email      TEXT,
            principal  INTEGER NOT NULL DEFAULT 0,
            ativo      INTEGER NOT NULL DEFAULT 1,
            criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_cliente_contatos_cliente ON cliente_contatos(cliente_id)`);

    {
        const migrated = await query<{ cnt: number }>(
            "SELECT COUNT(*) as cnt FROM pragma_table_info('cliente_pj_vinculo') WHERE name='id'"
        );
        if ((migrated[0]?.cnt ?? 0) > 0) {
            const pending = await query<{ id: string; pj_id: string }>(
                `SELECT c.id, c.pj_id FROM clientes c WHERE c.pj_id IS NOT NULL AND c.pj_id != '' AND c.tipo = 'PF' AND NOT EXISTS (SELECT 1 FROM cliente_pj_vinculo v WHERE v.pf_id = c.id AND v.pj_id = c.pj_id)`
            );
            for (const row of pending) {
                await execute(
                    `INSERT OR IGNORE INTO cliente_pj_vinculo (id, pf_id, pj_id, funcao, principal, criado_em) VALUES (?, ?, ?, NULL, 1, datetime('now'))`,
                    [`vinc-${row.id}-${row.pj_id}`, row.id, row.pj_id]
                ).catch(() => {});
            }
        }
    }

    // ================================================================
    // 4. MANIFESTACOES + FLUXO DE OUVIDORIA
    // ================================================================

    await execute(`
        CREATE TABLE IF NOT EXISTS manifestacoes (
            id               TEXT PRIMARY KEY,
            protocolo        TEXT NOT NULL UNIQUE,
            tipo_id          TEXT NOT NULL REFERENCES tipos_manifestacao(id),
            origem_id        TEXT NOT NULL REFERENCES origens(id),
            classificacao_id TEXT NOT NULL REFERENCES classificacoes(id),
            situacao_id      TEXT NOT NULL REFERENCES situacoes(id),
            cliente_id       TEXT REFERENCES clientes(id),
            obs_solicitante  TEXT,
            solicitante_nome  TEXT,
            solicitante_email TEXT,
            solicitante_telefone TEXT,
            assunto          TEXT NOT NULL,
            descricao        TEXT NOT NULL,
            prioridade       TEXT NOT NULL DEFAULT 'normal' CHECK(prioridade IN ('normal','urgente','critico')),
            status           TEXT NOT NULL DEFAULT 'aberta',
            responsavel_id   TEXT REFERENCES usuarios(id),
            setor_id         TEXT REFERENCES setores(id),
            anonimo          INTEGER NOT NULL DEFAULT 0,
            sigiloso         INTEGER NOT NULL DEFAULT 0,
            prazo_limite     TEXT,
            cancelamento_motivo TEXT,
            atribuido_em     TEXT,
            aceite_em        TEXT,
            avaliacao_satisfacao INTEGER,
            avaliacao_comentario TEXT,
            avaliacao_em     TEXT,
            manifestacao_origem_id TEXT REFERENCES manifestacoes(id),
            criado_em        TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em    TEXT NOT NULL DEFAULT (datetime('now')),
            encerrado_em     TEXT
        )
    `);
    // migração: adiciona campos de solicitante em bancos legados
    await execute(`ALTER TABLE manifestacoes ADD COLUMN solicitante_nome TEXT`).catch(() => {});
    await execute(`ALTER TABLE manifestacoes ADD COLUMN solicitante_email TEXT`).catch(() => {});
    await execute(`ALTER TABLE manifestacoes ADD COLUMN solicitante_telefone TEXT`).catch(() => {});
    // ADR-013: migração aditiva para bancos existentes (colunas novas)
    await execute(`ALTER TABLE manifestacoes ADD COLUMN anonimo INTEGER NOT NULL DEFAULT 0`).catch(() => {});
    await execute(`ALTER TABLE manifestacoes ADD COLUMN sigiloso INTEGER NOT NULL DEFAULT 0`).catch(() => {});
    await execute(`ALTER TABLE manifestacoes ADD COLUMN prazo_limite TEXT`).catch(() => {});
    await execute(`ALTER TABLE manifestacoes ADD COLUMN cancelamento_motivo TEXT`).catch(() => {});
    await execute(`ALTER TABLE manifestacoes ADD COLUMN atribuido_em TEXT`).catch(() => {});
    await execute(`ALTER TABLE manifestacoes ADD COLUMN aceite_em TEXT`).catch(() => {});
    await execute(`ALTER TABLE manifestacoes ADD COLUMN avaliacao_satisfacao INTEGER`).catch(() => {});
    await execute(`ALTER TABLE manifestacoes ADD COLUMN avaliacao_comentario TEXT`).catch(() => {});
    await execute(`ALTER TABLE manifestacoes ADD COLUMN avaliacao_em TEXT`).catch(() => {});
    await execute(`ALTER TABLE manifestacoes ADD COLUMN manifestacao_origem_id TEXT REFERENCES manifestacoes(id)`).catch(() => {});
    // Fase 1 — Competência (Subsecretaria de Resíduos)
    await execute(`ALTER TABLE manifestacoes ADD COLUMN competencia TEXT CHECK(competencia IN ('compete','nao_compete','pendente')) DEFAULT 'pendente'`).catch(() => {});
    await execute(`ALTER TABLE manifestacoes ADD COLUMN motivo_incompetencia TEXT`).catch(() => {});
    await execute(`ALTER TABLE manifestacoes ADD COLUMN orgao_destino TEXT`).catch(() => {});
    await execute(`ALTER TABLE manifestacoes ADD COLUMN data_competencia TEXT`).catch(() => {});
    // Fase 2 — Classificação Administrativa
    await execute(`ALTER TABLE manifestacoes ADD COLUMN subassunto_id TEXT`).catch(() => {});
    await execute(`ALTER TABLE manifestacoes ADD COLUMN subunidade_id TEXT`).catch(() => {});
    await execute(`ALTER TABLE manifestacoes ADD COLUMN programa_orcamentario_id TEXT`).catch(() => {});
    await execute(`
        CREATE TABLE IF NOT EXISTS subassuntos (
            id         TEXT PRIMARY KEY,
            assunto_id TEXT NOT NULL REFERENCES classificacoes(id) ON DELETE CASCADE,
            nome       TEXT NOT NULL,
            ativo      INTEGER NOT NULL DEFAULT 1
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_subassuntos_assunto ON subassuntos(assunto_id)`);
    await execute(`
        CREATE TABLE IF NOT EXISTS subunidades (
            id             TEXT PRIMARY KEY,
            setor_id       TEXT NOT NULL REFERENCES setores(id) ON DELETE CASCADE,
            nome           TEXT NOT NULL,
            responsavel_id TEXT REFERENCES usuarios(id),
            ativo          INTEGER NOT NULL DEFAULT 1
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_subunidades_setor ON subunidades(setor_id)`);
    await execute(`
        CREATE TABLE IF NOT EXISTS programas_orcamentarios (
            id        TEXT PRIMARY KEY,
            codigo    TEXT NOT NULL,
            nome      TEXT NOT NULL,
            exercicio INTEGER NOT NULL,
            ativo     INTEGER NOT NULL DEFAULT 1
        )
    `);
    // ADR-013 Fase 3: índices auxiliares para performance de SLA
    await execute(`CREATE INDEX IF NOT EXISTS idx_manifestacoes_status_criado ON manifestacoes(status, criado_em)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_manifestacoes_prazo_limite ON manifestacoes(prazo_limite) WHERE prazo_limite IS NOT NULL`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_manifestacoes_setor_status ON manifestacoes(setor_id, status)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_manifestacoes_origem ON manifestacoes(manifestacao_origem_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_manifestacoes_protocolo   ON manifestacoes(protocolo)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_manifestacoes_status      ON manifestacoes(status)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_manifestacoes_responsavel ON manifestacoes(responsavel_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_manifestacoes_cliente     ON manifestacoes(cliente_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_manifestacoes_setor       ON manifestacoes(setor_id)`);

    await execute(`
        CREATE TABLE IF NOT EXISTS tramitacoes (
            id              TEXT PRIMARY KEY,
            manifestacao_id TEXT NOT NULL REFERENCES manifestacoes(id) ON DELETE CASCADE,
            de_setor_id     TEXT REFERENCES setores(id),
            para_setor_id   TEXT NOT NULL REFERENCES setores(id),
            observacao      TEXT,
            usuario_id      TEXT NOT NULL REFERENCES usuarios(id),
            criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_tramitacoes_manifestacao ON tramitacoes(manifestacao_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_tramitacoes_para_setor   ON tramitacoes(para_setor_id)`);
    // Fase 3 — tipo de tramitação
    await execute(`ALTER TABLE tramitacoes ADD COLUMN tipo_tramitacao TEXT CHECK(tipo_tramitacao IN ('encaminhamento','transferencia','devolucao','cobranca')) DEFAULT 'encaminhamento'`).catch(() => {});

    await execute(`
        CREATE TABLE IF NOT EXISTS respostas (
            id              TEXT PRIMARY KEY,
            manifestacao_id TEXT NOT NULL REFERENCES manifestacoes(id) ON DELETE CASCADE,
            texto           TEXT NOT NULL,
            meio_envio      TEXT NOT NULL DEFAULT 'email' CHECK(meio_envio IN ('email','telefone','carta','presencial','portal')),
            enviada_por     TEXT NOT NULL REFERENCES usuarios(id),
            enviada_em      TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_respostas_manifestacao ON respostas(manifestacao_id)`);
    // Fase 5 — Editor/Formatador de Resposta
    await execute(`ALTER TABLE respostas ADD COLUMN resposta_formatada TEXT`).catch(() => {});
    await execute(`ALTER TABLE respostas ADD COLUMN modelo_id TEXT`).catch(() => {});
    await execute(`ALTER TABLE respostas ADD COLUMN revisada_por TEXT REFERENCES usuarios(id)`).catch(() => {});
    await execute(`ALTER TABLE respostas ADD COLUMN data_revisao TEXT`).catch(() => {});
    await execute(`
        CREATE TABLE IF NOT EXISTS modelos_resposta (
            id                   TEXT PRIMARY KEY,
            tipo_manifestacao_id TEXT NOT NULL,
            assunto_id           TEXT,
            titulo               TEXT NOT NULL,
            corpo                TEXT NOT NULL,
            ativo                INTEGER NOT NULL DEFAULT 1
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_modelos_tipo ON modelos_resposta(tipo_manifestacao_id)`);
    // Fase 6 — Canal de Envio ao Cidadão
    await execute(`
        CREATE TABLE IF NOT EXISTS envios_resposta (
            id              TEXT PRIMARY KEY,
            resposta_id     TEXT NOT NULL REFERENCES respostas(id) ON DELETE CASCADE,
            manifestacao_id TEXT NOT NULL REFERENCES manifestacoes(id) ON DELETE CASCADE,
            canal           TEXT NOT NULL CHECK(canal IN ('email','whatsapp','portal','impresso')),
            destinatario    TEXT,
            status_envio    TEXT NOT NULL DEFAULT 'pendente'
                              CHECK(status_envio IN ('pendente','enviado','falha')),
            data_envio      TEXT,
            erro            TEXT
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_envios_manifestacao ON envios_resposta(manifestacao_id)`);

    await execute(`
        CREATE TABLE IF NOT EXISTS despachos (
            id              TEXT PRIMARY KEY,
            manifestacao_id TEXT NOT NULL REFERENCES manifestacoes(id) ON DELETE CASCADE,
            texto           TEXT NOT NULL,
            despachado_por  TEXT NOT NULL REFERENCES usuarios(id),
            despachado_em   TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_despachos_manifestacao ON despachos(manifestacao_id)`);

    // tipos_prazo definido antes de prazos (FK tipo_prazo_id)
    await execute(`
        CREATE TABLE IF NOT EXISTS tipos_prazo (
            id         TEXT PRIMARY KEY,
            nome       TEXT NOT NULL UNIQUE,
            dias_padrao INTEGER,
            ativo      INTEGER NOT NULL DEFAULT 1,
            criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    await execute(`
        CREATE TABLE IF NOT EXISTS prazos (
            id              TEXT PRIMARY KEY,
            manifestacao_id TEXT NOT NULL REFERENCES manifestacoes(id) ON DELETE CASCADE,
            tipo_prazo_id   TEXT NOT NULL REFERENCES tipos_prazo(id),
            data_limite     TEXT NOT NULL,
            status          TEXT NOT NULL DEFAULT 'pendente'
                                CHECK(status IN ('pendente','cumprido','vencido')),
            cumprido_em     TEXT,
            criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_prazos_manifestacao ON prazos(manifestacao_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_prazos_data_limite  ON prazos(data_limite)`);
    // tipo_prazo TEXT — usado pelo código; tipo_prazo_id é o FK legado (mantido por compat)
    await execute(`ALTER TABLE prazos ADD COLUMN tipo_prazo TEXT`).catch(() => {});
    // Fase 4 — Cobrança automática por prazo
    await execute(`ALTER TABLE prazos ADD COLUMN cobranca_enviada INTEGER NOT NULL DEFAULT 0`).catch(() => {});
    await execute(`ALTER TABLE prazos ADD COLUMN data_cobranca TEXT`).catch(() => {});

    await execute(`
        CREATE TABLE IF NOT EXISTS notificacoes (
            id              TEXT PRIMARY KEY,
            usuario_id      TEXT NOT NULL REFERENCES usuarios(id),
            manifestacao_id TEXT REFERENCES manifestacoes(id) ON DELETE CASCADE,
            mensagem        TEXT NOT NULL,
            lida            INTEGER NOT NULL DEFAULT 0,
            criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
            lida_em         TEXT
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes(usuario_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_notificacoes_lida    ON notificacoes(lida)`);
    await execute(`ALTER TABLE notificacoes ADD COLUMN prazo_id TEXT`).catch(() => {});

    await execute(`
        CREATE TABLE IF NOT EXISTS historico_alteracoes (
            id              TEXT PRIMARY KEY,
            manifestacao_id TEXT NOT NULL REFERENCES manifestacoes(id) ON DELETE CASCADE,
            campo           TEXT NOT NULL,
            valor_anterior  TEXT,
            valor_novo      TEXT,
            alterado_por    TEXT NOT NULL REFERENCES usuarios(id),
            alterado_em     TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_historico_manifestacao ON historico_alteracoes(manifestacao_id)`);

    // ================================================================
    // ADR-013: NOVAS TABELAS DE OUVIDORIA
    // ================================================================

    // 1.1 Sequência de protocolo (NUP) — PK composta justificada (controle, não negócio)
    await execute(`
        CREATE TABLE IF NOT EXISTS protocolo_seq (
            ano    INTEGER NOT NULL,
            ultimo INTEGER NOT NULL DEFAULT 0,
            PRIMARY KEY (ano)
        )
    `);

    // 2.4 Templates de resposta — `modelos_resposta` JÁ é definida acima
    // (id, tipo_manifestacao_id, assunto_id, titulo, corpo, ativo + idx_modelos_tipo).
    // Esta 2ª definição era SILENCIOSAMENTE IGNORADA pelo CREATE TABLE IF NOT EXISTS
    // e usava colunas (tipo_id, criado_por, criado_em, atualizado_em) que nenhum
    // código consome — além de um índice sobre uma coluna inexistente nela. Removida
    // para eliminar a incoerência. Único consumidor: SqliteManifestacaoRepository.listModelosResposta.

    // 3.2 Notificações ao solicitante (rastreamento de canal)
    await execute(`
        CREATE TABLE IF NOT EXISTS notificacoes_solicitante (
            id              TEXT PRIMARY KEY,
            manifestacao_id TEXT NOT NULL REFERENCES manifestacoes(id) ON DELETE CASCADE,
            canal           TEXT NOT NULL,
            conteudo        TEXT NOT NULL,
            enviado_em      TEXT,
            status          TEXT NOT NULL DEFAULT 'pendente'
                                CHECK(status IN ('pendente','enviado','falhou')),
            usuario_id      TEXT NOT NULL REFERENCES usuarios(id),
            criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_notif_solicitante_manifestacao ON notificacoes_solicitante(manifestacao_id)`);

    // ================================================================
    // 5. CATÁLOGOS DE DIMENSÃO
    // ================================================================

    await execute(`
        CREATE TABLE IF NOT EXISTS tipos_residuo (
            id         TEXT PRIMARY KEY,
            codigo     TEXT NOT NULL UNIQUE,
            nome       TEXT NOT NULL,
            descricao  TEXT,
            cor        TEXT DEFAULT '#6B7280',
            ativo      INTEGER NOT NULL DEFAULT 1,
            id_externo INTEGER,
            sigla      TEXT,
            criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_tipos_residuo_codigo ON tipos_residuo(codigo)`);
    await execute(`ALTER TABLE tipos_residuo ADD COLUMN id_externo INTEGER`).catch(() => {});
    await execute(`ALTER TABLE tipos_residuo ADD COLUMN sigla TEXT`).catch(() => {});
    await execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_residuo_id_externo ON tipos_residuo(id_externo) WHERE id_externo IS NOT NULL`);

    // ================================================================
    // 6. CRM LOGÍSTICO — Roteiros e Execução de Coleta
    // ================================================================

    await execute(`
        CREATE TABLE IF NOT EXISTS roteiros (
            id              TEXT PRIMARY KEY,
            codigo          TEXT UNIQUE,
            nome            TEXT NOT NULL,
            descricao       TEXT,
            tipo_residuo_id TEXT REFERENCES tipos_residuo(id),
            residuo         TEXT,
            periodicidade   TEXT,
            turno           TEXT,
            base            TEXT,
            distrito        TEXT,
            dia_semana      TEXT,
            horario_inicio  TEXT,
            horario_fim     TEXT,
            setor_id        TEXT REFERENCES setores(id),
            situacao        TEXT DEFAULT 'ativo' CHECK(situacao IN ('ativo','inativo','suspenso')),
            criado_por      TEXT NOT NULL REFERENCES usuarios(id),
            criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em   TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    // Guard p/ DBs existentes: descrição livre do resíduo, sincronizada de comcap.cad_residuo
    await execute(`ALTER TABLE roteiros ADD COLUMN residuo TEXT`).catch(() => {});
    await execute(`CREATE INDEX IF NOT EXISTS idx_roteiros_codigo       ON roteiros(codigo)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_roteiros_nome         ON roteiros(nome)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_roteiros_situacao     ON roteiros(situacao)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_roteiros_setor        ON roteiros(setor_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_roteiros_tipo_residuo ON roteiros(tipo_residuo_id)`);

    // ADR-004: PK composta em junção com metadados
    await execute(`
        CREATE TABLE IF NOT EXISTS roteiro_clientes (
            id         TEXT,
            roteiro_id TEXT NOT NULL REFERENCES roteiros(id) ON DELETE CASCADE,
            cliente_id TEXT NOT NULL REFERENCES clientes(id),
            ordem      INTEGER NOT NULL DEFAULT 0,
            observacao TEXT,
            ativo      INTEGER NOT NULL DEFAULT 1,
            criado_em  TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (roteiro_id, cliente_id)
        )
    `);
    await execute(`ALTER TABLE roteiro_clientes ADD COLUMN id TEXT`).catch(() => {});
    await execute(`CREATE INDEX IF NOT EXISTS idx_roteiro_clientes_roteiro ON roteiro_clientes(roteiro_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_roteiro_clientes_cliente ON roteiro_clientes(cliente_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_roteiro_clientes_ordem   ON roteiro_clientes(roteiro_id, ordem)`);

    await execute(`
        CREATE TABLE IF NOT EXISTS execucao_coleta (
            id                       TEXT PRIMARY KEY,
            id_despacho              INTEGER,
            codigo_despacho          TEXT,
            roteiro_id               TEXT NOT NULL REFERENCES roteiros(id),
            data_execucao            TEXT NOT NULL,
            data_impressao           TEXT,
            status                   TEXT NOT NULL DEFAULT 'agendada'
                                         CHECK(status IN ('agendada','em_transito','em_execucao','concluida','cancelada')),
            motorista_id             TEXT REFERENCES usuarios(id),
            ajudante_id              TEXT REFERENCES usuarios(id),
            veiculo_placa            TEXT,
            veiculo_modelo           TEXT,
            motorista_nome_externo   TEXT,
            ajudante_nome_externo    TEXT,
            horario_saida_garagem    TEXT,
            horario_chegada_previsto TEXT,
            km_inicial               INTEGER,
            km_final                 INTEGER,
            peso_total               REAL,
            volume_total             REAL,
            numero_viagens           INTEGER,
            observacoes              TEXT,
            inicio_em                TEXT,
            fim_em                   TEXT,
            criado_em                TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em            TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_execucao_coleta_despacho  ON execucao_coleta(id_despacho)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_execucao_coleta_roteiro   ON execucao_coleta(roteiro_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_execucao_coleta_data      ON execucao_coleta(data_execucao)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_execucao_coleta_status    ON execucao_coleta(status)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_execucao_coleta_motorista ON execucao_coleta(motorista_id)`);

    // Pesagens externas (comcap.cad_balanca) vinculadas a uma execução — 1 linha por viagem/pesagem
    await execute(`
        CREATE TABLE IF NOT EXISTS execucao_pesagens (
            id              TEXT PRIMARY KEY,
            execucao_id     TEXT NOT NULL REFERENCES execucao_coleta(id) ON DELETE CASCADE,
            id_balanca      INTEGER,
            id_despacho     INTEGER,
            codigo_despacho TEXT,
            data_pesagem    TEXT,
            veiculo         TEXT,
            residuo         TEXT,
            origem          TEXT,
            destino         TEXT,
            tipo_coleta     TEXT,
            peso_liquido    REAL,
            situacao        INTEGER,
            status_despacho TEXT,
            criado_em       TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_execucao_pesagens_execucao ON execucao_pesagens(execucao_id)`);
    await execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_execucao_pesagens_balanca ON execucao_pesagens(id_balanca) WHERE id_balanca IS NOT NULL`);

    await execute(`
        CREATE TABLE IF NOT EXISTS execucao_coleta_historico (
            id              TEXT PRIMARY KEY,
            execucao_id     TEXT NOT NULL REFERENCES execucao_coleta(id) ON DELETE CASCADE,
            status_anterior TEXT,
            status_novo     TEXT NOT NULL,
            alterado_por    TEXT NOT NULL REFERENCES usuarios(id),
            alterado_em     TEXT NOT NULL DEFAULT (datetime('now')),
            observacao      TEXT
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_exec_historico_execucao ON execucao_coleta_historico(execucao_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_exec_historico_data     ON execucao_coleta_historico(alterado_em)`);

    await execute(`
        CREATE TABLE IF NOT EXISTS execucao_clientes (
            id               TEXT PRIMARY KEY,
            execucao_id      TEXT NOT NULL REFERENCES execucao_coleta(id) ON DELETE CASCADE,
            cliente_id       TEXT NOT NULL REFERENCES clientes(id),
            coleta_realizada INTEGER NOT NULL DEFAULT 0,
            quantidade       REAL,
            ocorrencia       TEXT,
            observacao       TEXT,
            horario_visita   TEXT,
            latitude         REAL,
            longitude        REAL,
            registrado_por   TEXT REFERENCES usuarios(id),
            registrado_em    TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(execucao_id, cliente_id)
        )
    `);
    // Guard p/ DBs existentes: quantidade coletada por ponto (nº de bombonas/contêineres)
    await execute(`ALTER TABLE execucao_clientes ADD COLUMN quantidade REAL`).catch(() => {});
    await execute(`CREATE INDEX IF NOT EXISTS idx_execucao_clientes_execucao ON execucao_clientes(execucao_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_execucao_clientes_cliente  ON execucao_clientes(cliente_id)`);

    await execute(`
        CREATE TABLE IF NOT EXISTS checklist_execucao (
            id            TEXT PRIMARY KEY,
            execucao_id   TEXT NOT NULL REFERENCES execucao_coleta(id) ON DELETE CASCADE,
            item          TEXT NOT NULL,
            concluido     INTEGER NOT NULL DEFAULT 0,
            observacao    TEXT,
            evidencia_url TEXT,
            latitude      REAL,
            longitude     REAL,
            concluido_em  TEXT,
            concluido_por TEXT REFERENCES usuarios(id),
            criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_checklist_execucao_execucao ON checklist_execucao(execucao_id)`);

    // ================================================================
    // 7. INTERCORRÊNCIAS DE COLETA
    // ================================================================

    await execute(`
        CREATE TABLE IF NOT EXISTS tipos_intercorrencia (
            id               TEXT PRIMARY KEY,
            nome             TEXT NOT NULL UNIQUE,
            descricao        TEXT,
            cor              TEXT DEFAULT '#6B7280',
            icone            TEXT,
            ordem            INTEGER NOT NULL DEFAULT 0,
            exige_quantidade INTEGER NOT NULL DEFAULT 0,
            exige_foto       INTEGER NOT NULL DEFAULT 0,
            ativo            INTEGER NOT NULL DEFAULT 1,
            criado_em        TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_tipos_intercorrencia_ordem ON tipos_intercorrencia(ordem)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_tipos_intercorrencia_ativo ON tipos_intercorrencia(ativo)`);

    await execute(`
        CREATE TABLE IF NOT EXISTS intercorrencias_coleta (
            id                 TEXT PRIMARY KEY,
            execucao_id        TEXT NOT NULL REFERENCES execucao_coleta(id) ON DELETE CASCADE,
            tipo_ocorrencia_id TEXT NOT NULL REFERENCES tipos_intercorrencia(id),
            tipo_residuo_id    TEXT REFERENCES tipos_residuo(id),
            quantidade         REAL,
            descricao          TEXT,
            anexo_id           TEXT,
            latitude           REAL,
            longitude          REAL,
            endereco           TEXT,
            resolvido          INTEGER NOT NULL DEFAULT 0,
            resolvido_em       TEXT,
            resolvido_por      TEXT REFERENCES usuarios(id),
            resolvido_como     TEXT,
            observacao         TEXT,
            registrado_por     TEXT NOT NULL REFERENCES usuarios(id),
            registrado_em      TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em      TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_intercorrencias_execucao  ON intercorrencias_coleta(execucao_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_intercorrencias_tipo      ON intercorrencias_coleta(tipo_ocorrencia_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_intercorrencias_resolvido ON intercorrencias_coleta(resolvido)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_intercorrencias_data      ON intercorrencias_coleta(registrado_em)`);

    // ================================================================
    // 8. ANEXOS UNIFICADOS (após execucao_clientes — FK formal)
    // ================================================================

    await execute(`
        CREATE TABLE IF NOT EXISTS anexos (
            id                  TEXT PRIMARY KEY,
            manifestacao_id     TEXT REFERENCES manifestacoes(id),
            execucao_cliente_id TEXT REFERENCES execucao_clientes(id),
            demanda_id          TEXT,
            tarefa_id           TEXT,
            preview_blob        BLOB,
            caminho_storage        TEXT,
            checksum_storage    TEXT,
            tipo_mime           TEXT,
            nome_arquivo        TEXT,
            tipo                TEXT NOT NULL DEFAULT 'foto'
                                    CHECK(tipo IN ('foto','documento','audio','video','comprovante')),
            sincronizado        INTEGER NOT NULL DEFAULT 0,
            criado_em           TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_anexos_manifestacao      ON anexos(manifestacao_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_anexos_execucao_cliente  ON anexos(execucao_cliente_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_anexos_demanda           ON anexos(demanda_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_anexos_tarefa            ON anexos(tarefa_id)`);
    // migração: adiciona colunas ausentes em bancos legados da tabela anexos
    await execute(`ALTER TABLE anexos ADD COLUMN nome_arquivo TEXT`).catch(() => {});
    await execute(`ALTER TABLE anexos ADD COLUMN caminho_storage TEXT`).catch(() => {});
    await execute(`ALTER TABLE anexos ADD COLUMN tipo_mime TEXT`).catch(() => {});
    await execute(`ALTER TABLE anexos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'foto'`).catch(() => {});
    await execute(`ALTER TABLE anexos ADD COLUMN sincronizado INTEGER NOT NULL DEFAULT 0`).catch(() => {});

    // Adicionar FK de intercorrencias → anexos após anexos existir
    // (SQLite não verifica FK em CREATE TABLE, só em DML — OK em runtime)

    // ================================================================
    // 9. VIEWS SQL
    // ================================================================

    try {
        await execute(`
            CREATE VIEW IF NOT EXISTS v_roteiro_folha_impressao AS
            SELECT
                rc.roteiro_id,
                r.nome        AS roteiro_nome,
                r.dia_semana,
                r.horario_inicio,
                r.horario_fim,
                rc.ordem,
                c.id          AS cliente_id,
                c.nome        AS cliente_nome,
                c.endereco AS logradouro,
                c.numero,
                c.bairro,
                c.latitude,
                c.longitude,
                c.elegivel_coleta_porta_a_porta
            FROM roteiro_clientes rc
            JOIN roteiros r ON r.id = rc.roteiro_id
            JOIN clientes  c ON c.id = rc.cliente_id
            WHERE rc.ativo = 1 AND c.ativo = 1 AND r.situacao = 'ativo'
            ORDER BY rc.roteiro_id, rc.ordem
        `);
    } catch (e) {
        console.warn(`[Bootstrap] v_roteiro_folha_impressao:`, e);
    }

    try {
        await execute(`
            CREATE VIEW IF NOT EXISTS v_execucao_resumo AS
            SELECT
                ec.id            AS execucao_id,
                ec.data_execucao,
                ec.data_impressao,
                ec.status,
                r.nome           AS roteiro_nome,
                u.nome           AS motorista_nome,
                COUNT(DISTINCT rc.cliente_id)  AS total_clientes_roteiro,
                COUNT(DISTINCT excl.cliente_id) AS clientes_visitados,
                SUM(CASE WHEN excl.coleta_realizada = 1 THEN 1 ELSE 0 END) AS coletas_ok,
                SUM(CASE WHEN excl.coleta_realizada = 0 AND excl.id IS NOT NULL THEN 1 ELSE 0 END) AS coletas_falha
            FROM execucao_coleta ec
            JOIN roteiros r ON r.id = ec.roteiro_id
            LEFT JOIN usuarios u ON u.id = ec.motorista_id
            LEFT JOIN roteiro_clientes rc ON rc.roteiro_id = ec.roteiro_id AND rc.ativo = 1
            LEFT JOIN execucao_clientes excl ON excl.execucao_id = ec.id
            GROUP BY ec.id
        `);
    } catch (e) {
        console.warn(`[Bootstrap] v_execucao_resumo:`, e);
    }

    // ================================================================
    // 10. FORMULÁRIOS E SUITE
    // ================================================================

    await execute(`
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

    // Seed: formulários de agendamento (Service Booking Engine — ADR-018)
    await execute(`
        INSERT OR IGNORE INTO registro_formularios (form_id, titulo, slug, conteudo, versao, ativo, situacao, tipo_form, criado_em, atualizado_em)
        VALUES (
            'form-agendamento-museu',
            'Agendamento — Museu do Lixo',
            'agendamento-museu',
            '${JSON.stringify({
                id: 'form-agendamento-museu',
                titulo: 'Agendamento — Museu do Lixo',
                campos: [
                    { id: 'cliente_nome', type: 'text', label: 'Nome da escola / grupo', required: true },
                    { id: 'cliente_id', type: 'text', label: 'CPF/CNPJ do responsável', required: true },
                    { id: 'email', type: 'email', label: 'E-mail', required: true },
                    { id: 'telefone', type: 'tel', label: 'Telefone', required: true },
                    { id: 'vagas_solicitadas', type: 'number', label: 'Quantidade de visitantes', required: true, valor_padrao: 1 },
                    { id: 'observacoes', type: 'textarea', label: 'Observações', required: false }
                ]
            }).replace(/'/g, "''")}',
            '1',
            1,
            'published',
            'agendamento',
            datetime('now'),
            datetime('now')
        )
    `).catch(() => {});

    await execute(`
        INSERT OR IGNORE INTO registro_formularios (form_id, titulo, slug, conteudo, versao, ativo, situacao, tipo_form, criado_em, atualizado_em)
        VALUES (
            'form-agendamento-volumosos',
            'Agendamento — Coleta de Volumosos',
            'agendamento-volumosos',
            '${JSON.stringify({
                id: 'form-agendamento-volumosos',
                titulo: 'Agendamento — Coleta de Volumosos',
                campos: [
                    { id: 'cliente_nome', type: 'text', label: 'Nome do solicitante', required: true },
                    { id: 'cliente_id', type: 'text', label: 'CPF/CNPJ', required: true },
                    { id: 'telefone', type: 'tel', label: 'Telefone', required: true },
                    { id: 'endereco', type: 'text', label: 'Endereço completo', required: true },
                    { id: 'bairro', type: 'text', label: 'Bairro', required: true },
                    { id: 'tipo_residuo', type: 'select', label: 'Tipo de resíduo', required: true, options: ['Móveis', 'Eletrodomésticos', 'Entulho', 'Madeira', 'Outros'] },
                    { id: 'vagas_solicitadas', type: 'number', label: 'Quantidade estimada (m³)', required: true, valor_padrao: 1 },
                    { id: 'observacoes', type: 'textarea', label: 'Observações', required: false }
                ]
            }).replace(/'/g, "''")}',
            '1',
            1,
            'published',
            'agendamento',
            datetime('now'),
            datetime('now')
        )
    `).catch(() => {});

    await execute(`
        INSERT OR IGNORE INTO registro_formularios (form_id, titulo, slug, conteudo, versao, ativo, situacao, tipo_form, criado_em, atualizado_em)
        VALUES (
            'form-agendamento-evento',
            'Agendamento — Palestra / Evento',
            'agendamento-evento',
            '${JSON.stringify({
                id: 'form-agendamento-evento',
                titulo: 'Agendamento — Palestra / Evento',
                campos: [
                    { id: 'cliente_nome', type: 'text', label: 'Nome do solicitante', required: true },
                    { id: 'cliente_id', type: 'text', label: 'CPF/CNPJ', required: true },
                    { id: 'email', type: 'email', label: 'E-mail', required: true },
                    { id: 'telefone', type: 'tel', label: 'Telefone', required: true },
                    { id: 'tema_evento', type: 'text', label: 'Tema / Título do evento', required: true },
                    { id: 'publico_alvo', type: 'text', label: 'Público-alvo', required: false },
                    { id: 'vagas_solicitadas', type: 'number', label: 'Quantidade estimada de participantes', required: true, valor_padrao: 1 },
                    { id: 'observacoes', type: 'textarea', label: 'Observações', required: false }
                ]
            }).replace(/'/g, "''")}',
            '1',
            1,
            'published',
            'agendamento',
            datetime('now'),
            datetime('now')
        )
    `).catch(() => {});

    await execute(`
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

    // pacotes: id INTEGER mantido por compatibilidade de código (id_pacote é a identidade lógica UUIDv7)
    await execute(`
        CREATE TABLE IF NOT EXISTS pacotes (
            id               INTEGER,
            criado_em        TEXT NOT NULL DEFAULT (datetime('now')),
            id_usuario          TEXT NOT NULL DEFAULT '0000000-000-000-000-00000000',
            dados            TEXT NOT NULL,
            tipo_form        TEXT,
            status_sinc      TEXT DEFAULT 'synced',
            ultima_modificacao    TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em    TEXT DEFAULT (datetime('now')),
            ativo            INTEGER DEFAULT 1,
            id_atividade      TEXT,
            status           TEXT DEFAULT 'submitted',
            revisor_id       TEXT,
            revisado_em      TEXT,
            motivo_rejeicao  TEXT,
            notas_revisao    TEXT,
            processado_em    TEXT,
            arquivado_em     TEXT,
            prazo_correcao   TEXT,
            id_tarefa          TEXT,
            submitted_at     TEXT,
            id_pacote       TEXT,
            num_versao       INTEGER DEFAULT 1,
            atual       INTEGER DEFAULT 1,
            tipo_modulo      TEXT,
            tipo_recurso    TEXT,
            carga_json     TEXT,
            id_proprietario         TEXT,
            id_entidade        TEXT,
            tipo_entidade      TEXT,
            bloqueado_por        TEXT,
            bloqueado_em        TEXT,
            ref_id_pacote   TEXT,
            ref_versao_pacote  INTEGER,
            fechado_em        TEXT,
            ultimo_id_envelope TEXT,
            ultimo_envelope_em TEXT
        )
    `);
    await execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_suite_package_version ON pacotes (id_pacote, num_versao)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_suite_entity ON pacotes (tipo_entidade, id_entidade)`);

    // tbl_suite — tabela normalizada para suite/pacotes (usada por FTS e sync)
    await execute(`
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
    `).catch((e) => console.warn('[Bootstrap] tbl_suite:', e));
    // Migração: garante created_at em tbl_suite pré-existente
    try {
        const cols = await query<{ name: string }>(`PRAGMA table_info('tbl_suite')`);
        if (!cols.some(c => c.name === 'created_at')) {
            await execute(`ALTER TABLE tbl_suite ADD COLUMN created_at TEXT`);
            console.log('[Bootstrap] added created_at to existing tbl_suite');
        }
    } catch { /* table may not exist */ }

    // Tabela FTS para busca full-text no inbox
    await execute(`
        CREATE VIRTUAL TABLE IF NOT EXISTS suite_fts USING fts5(
            suite_id UNINDEXED,
            texto_busca,
            content='',
            contentless_delete=1
        )
    `).catch((e) => console.warn('[Bootstrap] suite_fts:', e));

    // View normalizada para inbox (unifica pacotes + usuarios)
    await execute(`
        CREATE VIEW IF NOT EXISTS vw_inbox_normalizada AS
        SELECT
            p.id_pacote      AS id,
            p.id_usuario     AS user_id,
            p.criado_em,
            p.tipo_form      AS form_type,
            COALESCE(
                json_extract(p.dados, '$.titulo'),
                json_extract(p.carga_json, '$.titulo'),
                json_extract(p.dados, '$.form_data.titulo'),
                json_extract(p.carga_json, '$.form_data.titulo')
            ) AS titulo,
            u.nome           AS usuario_nome_completo,
            COALESCE(
                json_extract(p.dados, '$.localizacao'),
                json_extract(p.carga_json, '$.localizacao'),
                json_extract(p.dados, '$.form_data.localizacao'),
                json_extract(p.carga_json, '$.form_data.localizacao')
            ) AS localizacao,
            p.status_sinc    AS status,
            p.status         AS lifecycle_status,
            COALESCE(p.carga_json, p.dados) AS dados_completos,
            u.perfil         AS usuario_perfil,
            p.tipo_form
        FROM pacotes p
        LEFT JOIN usuarios u ON u.id = p.id_usuario
        WHERE p.ativo = 1
    `).catch((e) => console.warn('[Bootstrap] vw_inbox_normalizada:', e));

    await execute(`
        CREATE TABLE IF NOT EXISTS historico_pacotes (
            id              TEXT PRIMARY KEY,
            registro_id     TEXT NOT NULL,
            status_anterior TEXT,
            status_novo     TEXT NOT NULL,
            alterado_por    TEXT,
            alterado_em     TEXT NOT NULL DEFAULT (datetime('now')),
            motivo          TEXT,
            metadados        TEXT,
            id_pacote      TEXT,
            versao_de    INTEGER,
            versao_para      INTEGER,
            tipo_transferencia   TEXT
        )
    `);

    // ================================================================
    // 11. KANBAN — Projetos, Tarefas, Atividades
    // ================================================================

    await execute(`
        CREATE TABLE IF NOT EXISTS projetos (
            id             TEXT PRIMARY KEY,
            nome           TEXT NOT NULL,
            descricao      TEXT,
            cor            TEXT DEFAULT '#3B82F6',
            criado_por     TEXT NOT NULL,
            status         TEXT DEFAULT 'ativo',
            data_inicio    TEXT,
            data_fim       TEXT,
            responsavel_id TEXT,
            arquivado_em   TEXT,
            arquivado_por  TEXT,
            criado_em      TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em  TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    // ADR-012: migração de arquivado INTEGER → arquivado_em/arquivado_por
    await Promise.all([
        execute(`ALTER TABLE projetos ADD COLUMN arquivado_em  TEXT`).catch(() => {}),
        execute(`ALTER TABLE projetos ADD COLUMN arquivado_por TEXT`).catch(() => {}),
    ]);
    // Migra dados legados: arquivado=1 → arquivado_em=atualizado_em
    await execute(`
        UPDATE projetos SET arquivado_em = atualizado_em
        WHERE arquivado_em IS NULL AND arquivado = 1
    `).catch(() => {});
    // ADR-024: controle de acesso horizontal por setor
    await execute(`ALTER TABLE projetos ADD COLUMN setor_id TEXT REFERENCES setores(id)`).catch(() => {});
    await execute(`CREATE INDEX IF NOT EXISTS idx_projetos_setor ON projetos(setor_id)`).catch(() => {});

    // ADR-004: FKs formais com ON DELETE CASCADE em tabela de junção
    await execute(`
        CREATE TABLE IF NOT EXISTS projetos_interessados (
            projeto_id TEXT NOT NULL REFERENCES projetos(id) ON DELETE CASCADE,
            usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            permissao  TEXT NOT NULL DEFAULT 'leitura',
            PRIMARY KEY (projeto_id, usuario_id)
        )
    `);

    await execute(`
        CREATE TABLE IF NOT EXISTS tarefas_interessados (
            tarefa_id  TEXT NOT NULL REFERENCES tarefas(id) ON DELETE CASCADE,
            usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
            permissao  TEXT NOT NULL DEFAULT 'leitura',
            PRIMARY KEY (tarefa_id, usuario_id)
        )
    `);

    await execute(`
        CREATE TABLE IF NOT EXISTS tarefas (
            id                 TEXT PRIMARY KEY,
            projeto_id         TEXT,
            titulo             TEXT NOT NULL,
            descricao          TEXT,
            status             TEXT DEFAULT 'a_fazer',
            prioridade         TEXT DEFAULT 'media',
            atribuido_para     TEXT,
            criado_por         TEXT NOT NULL,
            prazo              TEXT,
            prazo_fim          TEXT,
            tipo_prazo         TEXT,
            ordem              INTEGER DEFAULT 0,
            id_formulario   TEXT,
            suite_id           TEXT,
            etiquetas               TEXT DEFAULT '[]',
            setor_id           TEXT,
            arquivado          INTEGER DEFAULT 0,
            deletado_em        TEXT,
            deletado_por       TEXT,
            tarefa_pai_id     TEXT,
            tarefa_container_id  TEXT,
            id_ciclo           TEXT,
            depende_tarefa_id TEXT,
            versao_snapshot       TEXT,
            hash_snapshot          TEXT,
            snapshot_congelado_em     TEXT,
            localizacao           TEXT,
            carga            TEXT,
            recorrencia        TEXT,
            demanda_id         TEXT,
            aprovado_por       TEXT,
            origem             TEXT,
            motivo_rejeicao    TEXT,
            criado_em          TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em      TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`ALTER TABLE tarefas ADD COLUMN aprovado_por    TEXT`).catch(() => {});
    await execute(`ALTER TABLE tarefas ADD COLUMN origem          TEXT`).catch(() => {});
    await execute(`ALTER TABLE tarefas ADD COLUMN motivo_rejeicao TEXT`).catch(() => {});
    await execute(`ALTER TABLE tarefas ADD COLUMN slot_id         TEXT`).catch(() => {});
    await execute(`CREATE INDEX IF NOT EXISTS idx_tarefas_demanda ON tarefas(demanda_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_tarefas_slot    ON tarefas(slot_id)`).catch(() => {});

    await execute(`
        CREATE TABLE IF NOT EXISTS tarefa_formularios (
            id               TEXT PRIMARY KEY,
            tarefa_id        TEXT NOT NULL REFERENCES tarefas(id),
            id_formulario TEXT NOT NULL,
            versao_formulario     INTEGER NOT NULL DEFAULT 1,
            snapshot_formulario    TEXT NOT NULL,
            ordem            INTEGER NOT NULL DEFAULT 0,
            obrigatorio      INTEGER NOT NULL DEFAULT 1,
            concluido        INTEGER NOT NULL DEFAULT 0,
            concluido_em     TEXT,
            criado_em        TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    await execute(`
        CREATE TABLE IF NOT EXISTS tarefas_anexos (
            id            TEXT PRIMARY KEY,
            tarefa_id     TEXT NOT NULL,
            usuario_id    TEXT,
            nome_arquivo  TEXT NOT NULL,
            url_storage   TEXT NOT NULL,
            tipo_mime     TEXT,
            tamanho_bytes INTEGER,
            created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    await execute(`
        CREATE TABLE IF NOT EXISTS tarefas_comentarios (
            id         TEXT PRIMARY KEY,
            tarefa_id  TEXT NOT NULL,
            usuario_id TEXT NOT NULL,
            comentario TEXT NOT NULL,
            criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    await execute(`
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

    await execute(`
        CREATE TABLE IF NOT EXISTS activities (
            id            TEXT PRIMARY KEY,
            titulo        TEXT NOT NULL,
            descricao     TEXT,
            atribuido_para TEXT,
            formulario_id TEXT NOT NULL,
            dados         TEXT DEFAULT '{}',
            status        TEXT DEFAULT 'pendente',
            prioridade    TEXT DEFAULT 'media',
            prazo         TEXT,
            criado_por    TEXT,
            concluido_em  TEXT,
            suite_id      TEXT,
            localizacao   TEXT,
            criado_em     TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    // ================================================================
    // 12. DEMANDAS
    // ================================================================

    await execute(`
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
            caminho_arquivo       TEXT,
            status_arquivo     TEXT,
            ultimo_id_envelope   TEXT,
            ultimo_envelope_em   TEXT,
            criado_em          TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em      TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    // ADR-024: controle de acesso horizontal por setor
    await execute(`ALTER TABLE demandas ADD COLUMN setor_id TEXT REFERENCES setores(id)`).catch(() => {});
    await execute(`CREATE INDEX IF NOT EXISTS idx_demandas_setor ON demandas(setor_id)`).catch(() => {});

    await execute(`
        CREATE TABLE IF NOT EXISTS demanda_eventos (
            id             TEXT PRIMARY KEY,
            demanda_id     TEXT NOT NULL REFERENCES demandas(id),
            tipo           TEXT NOT NULL,
            correlation_id TEXT,
            causation_id   TEXT,
            carga        TEXT NOT NULL,
            id_dispositivo      TEXT,
            id_usuario        TEXT,
            criado_em      TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    // ================================================================
    // 13. AUDITORIA
    // ================================================================

    await execute(`
        CREATE TABLE IF NOT EXISTS log_acoes (
            id          TEXT PRIMARY KEY,
            id_acao   TEXT NOT NULL,
            tipo_alvo TEXT NOT NULL,
            id_alvo   TEXT NOT NULL,
            id_usuario     TEXT NOT NULL,
            resultado   TEXT,
            erro        TEXT,
            criado_em   TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_action_log_target ON log_acoes(tipo_alvo, id_alvo)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_action_log_user   ON log_acoes(id_usuario)`);

    // ADR-022: correlação causal de eventos
    await execute(`ALTER TABLE log_acoes ADD COLUMN correlacao_id TEXT`).catch(() => {});
    await execute(`ALTER TABLE log_acoes ADD COLUMN causacao_id   TEXT`).catch(() => {});
    await execute(`CREATE INDEX IF NOT EXISTS idx_log_acoes_correlacao ON log_acoes(correlacao_id)`);

    await execute(`
        CREATE TABLE IF NOT EXISTS log_auditoria (
            id           TEXT PRIMARY KEY,
            id_ator     TEXT NOT NULL,
            perfil_ator TEXT NOT NULL,
            acao       TEXT NOT NULL,
            tabela_alvo TEXT,
            id_alvo    TEXT,
            valor_anterior    TEXT,
            valor_novo    TEXT,
            metadados     TEXT,
            sincronizado       INTEGER NOT NULL DEFAULT 0,
            criado_em    TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_audit_log_actor  ON log_auditoria(id_ator)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_audit_log_target ON log_auditoria(tabela_alvo, id_alvo)`);

    // ================================================================
    // 14. MÓDULOS DINÂMICOS
    // ================================================================

    await ensureModuleTables(execute);

    // ================================================================
    // 15. DASHBOARD E WIDGETS
    // ================================================================

    await execute(`
        CREATE TABLE IF NOT EXISTS registro_visualizacoes (
            id            TEXT PRIMARY KEY,
            titulo        TEXT NOT NULL,
            perfis        TEXT NOT NULL DEFAULT '[]',
            layout        TEXT DEFAULT 'grid-2',
            widgets       TEXT NOT NULL DEFAULT '[]',
            tipo_modulo   TEXT,
            ativo         INTEGER NOT NULL DEFAULT 1,
            id_usuario       TEXT,
            modelo   INTEGER NOT NULL DEFAULT 0,
            criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_view_registry_user ON registro_visualizacoes(id_usuario)`);

    await execute(`
        CREATE TABLE IF NOT EXISTS registro_decisoes (
            id                  TEXT PRIMARY KEY,
            tipo_alvo         TEXT NOT NULL,
            acao              TEXT NOT NULL,
            perfis              TEXT NOT NULL DEFAULT '[]',
            ativado_quando        TEXT DEFAULT '[]',
            passos               TEXT DEFAULT '[]',
            parametros              TEXT DEFAULT '{}',
            tipo_consequencia    TEXT DEFAULT 'terminal',
            padrao_consequencia TEXT,
            config_consequencia  TEXT DEFAULT '{}',
            ativo               INTEGER NOT NULL DEFAULT 1,
            criado_em           TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em       TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    await execute(`
        CREATE TABLE IF NOT EXISTS instancias_widgets_usuario (
            id             TEXT PRIMARY KEY,
            id_usuario        TEXT NOT NULL,
            dashboard_id   TEXT NOT NULL REFERENCES registro_visualizacoes(id) ON DELETE CASCADE,
            widget_type    TEXT NOT NULL CHECK(widget_type IN (
                               'kpi_card','bar_chart','pie_chart','line_chart',
                               'area_chart','table','recent_activity'
                           )),
            data_source    TEXT NOT NULL DEFAULT '{}',
            display_config TEXT NOT NULL DEFAULT '{}',
            position_x     INTEGER NOT NULL DEFAULT 0,
            position_y     INTEGER NOT NULL DEFAULT 0,
            position_w     INTEGER NOT NULL DEFAULT 6,
            position_h     INTEGER NOT NULL DEFAULT 1,
            position_order INTEGER NOT NULL DEFAULT 0,
            criado_em      TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em  TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_uwi_dashboard ON instancias_widgets_usuario(dashboard_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_uwi_user      ON instancias_widgets_usuario(id_usuario)`);

    // ================================================================
    // 16. SYNC — Infraestrutura de eventos (ADR-010)
    // ================================================================

    await execute(`
        CREATE TABLE IF NOT EXISTS fila_eventos_sync (
            id             TEXT PRIMARY KEY,
            tipo           TEXT NOT NULL,
            carga        TEXT NOT NULL,
            tipo_agregado TEXT,
            id_agregado   TEXT,
            id_correlacao TEXT,
            id_causa   TEXT,
            sequencia            INTEGER,
            situacao         TEXT NOT NULL DEFAULT 'pending'
                               CHECK(situacao IN ('pending','sent','failed')),
            tentativas       INTEGER NOT NULL DEFAULT 0,
            id_envelope    TEXT,
            dominio         TEXT,
            id_entidade      TEXT,
            caminho_storage   TEXT,
            criado_em      TEXT NOT NULL DEFAULT (datetime('now')),
            enviado_em        TEXT
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_sync_event_queue_status ON fila_eventos_sync(situacao)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_sync_event_queue_entity ON fila_eventos_sync(tipo_agregado, id_agregado)`);
    await execute(`ALTER TABLE fila_eventos_sync ADD COLUMN situacao_lan TEXT DEFAULT 'pending'`).catch(() => {});

    // LAN Server — fila de eventos recebidos na rede local (independente da fila cloud)
    await execute(`
        CREATE TABLE IF NOT EXISTS fila_eventos_lan (
            id                 TEXT PRIMARY KEY,
            tipo               TEXT NOT NULL,
            carga              TEXT NOT NULL,
            sequencia_lan      INTEGER NOT NULL,
            id_roteamento      TEXT NOT NULL,
            dispositivo_origem TEXT NOT NULL,
            recebido_em        TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_fila_eventos_lan_routing ON fila_eventos_lan(id_roteamento, sequencia_lan)`);

    await execute(`
        CREATE TABLE IF NOT EXISTS log_eventos_aplicados (
            envelope_id   TEXT PRIMARY KEY,
            tipo_entidade   TEXT NOT NULL,
            id_entidade     TEXT NOT NULL,
            caminho_storage  TEXT NOT NULL,
            dispositivo_origem TEXT,
            usuario_origem   TEXT,
            aplicado_em    TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_sync_applied_log_entity ON log_eventos_aplicados(tipo_entidade, id_entidade)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_sync_applied_log_source ON log_eventos_aplicados(dispositivo_origem)`);

    // ADR-051 / ADR-011: escrow do sync_salt para rotação e recuperação de chave.
    // Migrado de desktop/migrations/011_add_key_escrow.sql para o schema canônico.
    await execute(`
        CREATE TABLE IF NOT EXISTS sync_salt_history (
            id             TEXT PRIMARY KEY,
            user_id        TEXT NOT NULL,
            salt_encrypted TEXT NOT NULL,
            salt_hash      TEXT NOT NULL,
            replaced_at    TEXT NOT NULL DEFAULT (datetime('now')),
            replaced_by    TEXT NOT NULL,
            reason         TEXT,
            FOREIGN KEY (user_id) REFERENCES usuarios(id)
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_salt_history_user ON sync_salt_history(user_id, replaced_at DESC)`);

    await execute(`
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
    await execute(`CREATE INDEX IF NOT EXISTS idx_sync_gap_log_routing ON log_gaps_sync(id_roteamento)`);

    await execute(`
        CREATE TABLE IF NOT EXISTS cursor_sync (
            dominio         TEXT PRIMARY KEY,
            ultimo_sync_em TEXT NOT NULL,
            atualizado_em  TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    await execute(`
        CREATE TABLE IF NOT EXISTS manifesto_sync (
            id_roteamento    TEXT PRIMARY KEY,
            sequencia           INTEGER NOT NULL DEFAULT 0,
            ultimo_id_evento TEXT,
            atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    await execute(`
        CREATE TABLE IF NOT EXISTS log_dispositivos_sync (
            id_dispositivo TEXT NOT NULL,
            sequencia       INTEGER NOT NULL,
            id_evento  TEXT NOT NULL,
            confirmado     INTEGER NOT NULL DEFAULT 0,
            enviado_em TEXT,
            PRIMARY KEY (id_dispositivo, sequencia)
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_sync_device_log_device ON log_dispositivos_sync(id_dispositivo)`);

    // ================================================================
    // ADR-020: Configurações do sistema (chave-valor)
    // ================================================================
    await execute(`
        CREATE TABLE IF NOT EXISTS tbl_configuracoes_sistema (
            chave         TEXT PRIMARY KEY,
            valor         TEXT NOT NULL DEFAULT '',
            descricao     TEXT,
            atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`INSERT OR IGNORE INTO tbl_configuracoes_sistema (chave, valor, descricao)
        VALUES ('lan_sync_path', '', 'Caminho da pasta LAN para sincronização local (vazio = desativado)')`).catch(() => {});
    await execute(`INSERT OR IGNORE INTO tbl_configuracoes_sistema (chave, valor, descricao)
        VALUES ('pg_legacy_host', '172.16.76.202', 'Host do PostgreSQL legado (sync roteiros/pesagens)')`).catch(() => {});
    await execute(`INSERT OR IGNORE INTO tbl_configuracoes_sistema (chave, valor, descricao)
        VALUES ('pg_legacy_port', '5432', 'Porta do PostgreSQL legado')`).catch(() => {});
    await execute(`INSERT OR IGNORE INTO tbl_configuracoes_sistema (chave, valor, descricao)
        VALUES ('pg_legacy_db', 'geo_fpolis', 'Nome do banco PostgreSQL legado')`).catch(() => {});
    await execute(`INSERT OR IGNORE INTO tbl_configuracoes_sistema (chave, valor, descricao)
        VALUES ('pg_legacy_user', 'smma', 'Usuário do PostgreSQL legado')`).catch(() => {});
    await execute(`INSERT OR IGNORE INTO tbl_configuracoes_sistema (chave, valor, descricao)
        VALUES ('pg_legacy_password', '', 'Senha do PostgreSQL legado')`).catch(() => {});

    await execute(`
        CREATE TABLE IF NOT EXISTS tbl_email_config (
            id            TEXT PRIMARY KEY DEFAULT 'default',
            smtp_host     TEXT NOT NULL DEFAULT '',
            smtp_port     INTEGER NOT NULL DEFAULT 587,
            smtp_user     TEXT NOT NULL DEFAULT '',
            smtp_password TEXT NOT NULL DEFAULT '',
            smtp_password_encrypted BLOB,
            from_email    TEXT NOT NULL DEFAULT '',
            from_name     TEXT NOT NULL DEFAULT '',
            use_tls       INTEGER NOT NULL DEFAULT 1,
            enabled       INTEGER NOT NULL DEFAULT 0,
            atualizado_em TEXT
        )
    `);
    await execute(`ALTER TABLE tbl_email_config ADD COLUMN smtp_password_encrypted BLOB`).catch(() => {});

    // ================================================================
    // 17. SEED — Catálogos iniciais (idempotente)
    // ================================================================

    try {
        const c = await query<{ n: number }>(`SELECT COUNT(*) as n FROM tipos_prazo`);
        if (c[0]?.n === 0) {
            await execute(`INSERT INTO tipos_prazo (id, nome, dias_padrao, ativo) VALUES
                ('resposta',    'Resposta ao Cidadão',         15, 1),
                ('solucao',     'Solução do Problema',         30, 1),
                ('prorrogacao', 'Prorrogação Administrativa',  15, 1)
            `);
            console.log('[Seed] tipos_prazo OK');
        }
    } catch (e) { console.warn('[Seed] tipos_prazo:', e); }

    try {
        const c = await query<{ n: number }>(`SELECT COUNT(*) as n FROM tipos_manifestacao`);
        if (c[0]?.n === 0) {
            await execute(`INSERT INTO tipos_manifestacao (id, nome, descricao, prazo_dias_corridos, prazo_urgente_dias) VALUES
                ('reclamacao', 'Reclamação',  'Insatisfação com serviço ou produto', 30, NULL),
                ('sugestao',   'Sugestão',    'Proposta de melhoria',                30, NULL),
                ('elogio',     'Elogio',      'Reconhecimento positivo',             30, NULL),
                ('denuncia',   'Denúncia',    'Comunicação de irregularidade',       30, 5),
                ('solicitacao','Solicitação', 'Pedido de informação ou serviço',     20, NULL),
                ('informacao', 'Informação',  'Solicitação de informação geral',     30, NULL)
            `);
            console.log('[Seed] tipos_manifestacao OK');
        }
    } catch (e) { console.warn('[Seed] tipos_manifestacao:', e); }
    // ADR-013: seed de prazos para bancos existentes que já tinham tipos_manifestacao sem prazo
    try {
        await execute(`UPDATE tipos_manifestacao SET prazo_dias_corridos = 30 WHERE id = 'reclamacao' AND prazo_dias_corridos IS NULL`);
        await execute(`UPDATE tipos_manifestacao SET prazo_dias_corridos = 20 WHERE id = 'solicitacao' AND prazo_dias_corridos IS NULL`);
        await execute(`UPDATE tipos_manifestacao SET prazo_dias_corridos = 30, prazo_urgente_dias = 5 WHERE id = 'denuncia' AND prazo_dias_corridos IS NULL`);
    } catch (e) { /* silencioso */ }

    try {
        const c = await query<{ n: number }>(`SELECT COUNT(*) as n FROM situacoes`);
        if (c[0]?.n === 0) {
            await execute(`INSERT INTO situacoes (id, nome, descricao) VALUES
                ('aguardando_analise',  'Aguardando Análise',   'Manifestação recebida, aguardando triagem'),
                ('em_atendimento',      'Em Atendimento',       'Em processo de investigação'),
                ('aguardando_resposta', 'Aguardando Resposta',  'Aguardando confirmação do manifestante'),
                ('concluido',           'Concluído',            'Processo encerrado com sucesso'),
                ('arquivado',           'Arquivado',            'Manifestação arquivada sem resolução')
            `);
            console.log('[Seed] situacoes OK');
        }
    } catch (e) { console.warn('[Seed] situacoes:', e); }

    try {
        const c = await query<{ n: number }>(`SELECT COUNT(*) as n FROM origens`);
        if (c[0]?.n === 0) {
            await execute(`INSERT INTO origens (id, nome, descricao) VALUES
                ('telefone',       'Telefone',          'Atendimento telefônico / call center'),
                ('email',          'E-mail',            'Correspondência eletrônica'),
                ('presencial',     'Presencial',        'Atendimento presencial em balcão'),
                ('site',           'Site / Portal',     'Formulário online'),
                ('app_cidadao',    'App do Cidadão',    'Aplicativo móvel do cidadão'),
                ('proprio_sistema','Sistema',           'Gerado internamente pelo sistema')
            `);
            console.log('[Seed] origens OK');
        }
    } catch (e) { console.warn('[Seed] origens:', e); }

    try {
        const c = await query<{ n: number }>(`SELECT COUNT(*) as n FROM classificacoes`);
        if (c[0]?.n === 0) {
            await execute(`INSERT INTO classificacoes (id, nome, descricao) VALUES
                ('coleta_nao_realizada', 'Coleta Não Realizada',   'Coleta não efetuada no local'),
                ('coleta_irregular',     'Coleta Irregular',       'Coleta em horário inadequado'),
                ('lixo_acumulado',       'Lixo Acumulado',         'Acúmulo de lixo na via pública'),
                ('veiculo_lixeiro',      'Veículo Lixeiro',        'Problema com veículo coletor'),
                ('motorista',            'Conduta do Motorista',   'Conduta inadequada do motorista'),
                ('cata_treco',           'Cata-Treco',             'Solicitação de coleta de volumosos'),
                ('entulho',              'Entulho',                'Resíduos de construção civil'),
                ('outros',               'Outros',                 'Outros tipos de ocorrência')
            `);
            console.log('[Seed] classificacoes OK');
        }
    } catch (e) { console.warn('[Seed] classificacoes:', e); }

    try {
        const c = await query<{ n: number }>(`SELECT COUNT(*) as n FROM tipos_residuo`);
        if (c[0]?.n === 0) {
            await execute(`INSERT INTO tipos_residuo (id, codigo, nome, descricao, cor) VALUES
                ('tr-rsu',   'RSU',   'Resíduo Sólido Urbano', 'Lixo doméstico comum',                '#6B7280'),
                ('tr-rec',   'REC',   'Reciclável',            'Papel, plástico, metal e vidro',       '#10B981'),
                ('tr-org',   'ORG',   'Orgânico',              'Resíduos de jardim e alimentos',       '#22C55E'),
                ('tr-ent',   'ENT',   'Entulho',               'Resíduos de construção civil',         '#78716C'),
                ('tr-pod',   'POD',   'Poda',                  'Galhos, folhas e jardinagem',          '#166534'),
                ('tr-ct',    'CT',    'Cata-Treco',            'Móveis, eletrodomésticos, volumosos',  '#F59E0B'),
                ('tr-per',   'PER',   'Perigoso',              'Pilhas, lâmpadas, tintas, solventes',  '#EF4444'),
                ('tr-saude', 'SAUDE', 'Saúde',                 'Resíduos de serviços de saúde',        '#DC2626'),
                ('tr-misto', 'MISTO', 'Misto',                 'Mistura de resíduos não segregados',   '#6B7280')
            `);
            console.log('[Seed] tipos_residuo OK');
        }
    } catch (e) { console.warn('[Seed] tipos_residuo:', e); }

    try {
        const c = await query<{ n: number }>(`SELECT COUNT(*) as n FROM tipos_intercorrencia`);
        if (c[0]?.n === 0) {
            await execute(`INSERT INTO tipos_intercorrencia
                (id, nome, descricao, cor, icone, ordem, exige_quantidade, exige_foto) VALUES
                ('ti-problema',    'Problema Operacional', 'Problema operacional geral',        '#EF4444', 'alert-triangle',  1, 0, 1),
                ('ti-rejeito',     'Rejeito',              'Material não coletável',             '#F97316', 'x-circle',        2, 1, 0),
                ('ti-falta',       'Falta de Coleta',      'Cliente não atendido',               '#3B82F6', 'trash',           3, 0, 0),
                ('ti-impedimento', 'Impedimento',          'Acesso bloqueado ao ponto',          '#8B5CF6', 'ban',             4, 0, 1),
                ('ti-quantidade',  'Quantidade Divergente','Quantidade diferente do esperado',   '#10B981', 'hash',            5, 1, 0),
                ('ti-veiculo',     'Problema no Veículo',  'Avaria ou problema mecânico',        '#F59E0B', 'truck',           6, 0, 1),
                ('ti-outros',      'Outros',               'Outros tipos de intercorrência',     '#6B7280', 'more-horizontal', 7, 0, 0)
            `);
            console.log('[Seed] tipos_intercorrencia OK');
        }
    } catch (e) { console.warn('[Seed] tipos_intercorrencia:', e); }

    try {
        await execute(`INSERT OR IGNORE INTO registro_dados (id, tipo, chave, conteudo) VALUES
            ('ouv-msg-1', 'mensagens_template', 'Resposta Padrão', '{"texto":"Sua solicitação foi registrada. Protocolo: {protocolo}"}'),
            ('ouv-msg-2', 'mensagens_template', 'Encerramento',    '{"texto":"Seu protocolo foi encerrado. Agradecemos o contato."}')
        `);
    } catch (e) { console.warn('[Seed] registro_dados:', e); }

    // ================================================================
    // 18. SERVICE BOOKING ENGINE (ADR-018) — Tipos dinâmicos + Slots
    // ================================================================

    await execute(`
        CREATE TABLE IF NOT EXISTS tbl_service_types (
            id                   TEXT PRIMARY KEY,
            nome                 TEXT NOT NULL,
            descricao            TEXT,
            form_id              TEXT,
            validator_key        TEXT,
            requer_fotos         INTEGER NOT NULL DEFAULT 0,
            bairros_obrigatorios INTEGER NOT NULL DEFAULT 0,
            capacidade_padrao    INTEGER,
            icone                TEXT,
            cor                  TEXT,
            ativo                INTEGER NOT NULL DEFAULT 1,
            setor_id             TEXT REFERENCES setores(id),
            criado_em            TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em        TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_service_types_ativo ON tbl_service_types(ativo)`);
    await execute(`ALTER TABLE tbl_service_types ADD COLUMN setor_id TEXT REFERENCES setores(id)`).catch(() => {});

    await execute(`
        CREATE TABLE IF NOT EXISTS tbl_service_slots (
            id              TEXT PRIMARY KEY,
            service_type_id TEXT NOT NULL REFERENCES tbl_service_types(id),
            titulo          TEXT NOT NULL,
            descricao       TEXT,
            data_inicio     TEXT NOT NULL,
            data_fim        TEXT NOT NULL,
            horario_inicio  TEXT,
            horario_fim     TEXT,
            capacidade      INTEGER,
            bairros         TEXT NOT NULL DEFAULT '[]',
            local           TEXT,
            vagas_ocupadas  INTEGER NOT NULL DEFAULT 0,
            status          TEXT NOT NULL DEFAULT 'rascunho'
                              CHECK(status IN ('rascunho','publicado','encerrado','cancelado')),
            criado_por      TEXT NOT NULL,
            criado_em       TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em   TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_service_slots_type   ON tbl_service_slots(service_type_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_service_slots_status ON tbl_service_slots(status)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_service_slots_datas  ON tbl_service_slots(data_inicio, data_fim)`);
    await execute(`ALTER TABLE tbl_service_slots ADD COLUMN tipo_prazo TEXT`).catch(() => {});
    await execute(`ALTER TABLE tbl_service_slots ADD COLUMN recorrencia TEXT`).catch(() => {});

    // ADR-019: Desacoplamento Booking/Task
    await execute(`ALTER TABLE tbl_service_types ADD COLUMN abertura_regra TEXT NOT NULL DEFAULT '{"tipo":"imediato"}'`).catch(() => {});
    // ADR-053: Flag requerMapa para exibição de roteiro geográfico
    await execute(`ALTER TABLE tbl_service_types ADD COLUMN requer_mapa INTEGER NOT NULL DEFAULT 0`).catch(() => {});
    await execute(`UPDATE tbl_service_types SET requer_mapa = 1 WHERE id IN ('volumosos', 'evento')`).catch(() => {});

    // Seed: executa APÓS o ALTER que adiciona `requer_mapa` (referenciado no INSERT).
    try {
        const c = await query<{ n: number }>(`SELECT COUNT(*) as n FROM tbl_service_types`);
        if (c[0]?.n === 0) {
            await execute(`INSERT INTO tbl_service_types (id, nome, descricao, form_id, validator_key, requer_fotos, bairros_obrigatorios, requer_mapa, capacidade_padrao, icone, cor, ativo) VALUES
                ('museu',     'Museu do Lixo',       'Visitas ao Museu do Lixo para grupos de até 25 pessoas',  'form-agendamento-museu',     'museu',     0, 0, 0, 25,  '🏛️', '#3B82F6', 1),
                ('volumosos', 'Coleta de Volumosos', 'Retirada de resíduos volumosos por zona de bairros',      'form-agendamento-volumosos', 'volumosos', 1, 1, 1, 10, '🚚', '#22C55E', 1),
                ('evento',    'Palestra / Evento',   'Palestras e eventos com demanda livre',                   'form-agendamento-evento',    'evento',    0, 0, 1, NULL,'🎤', '#F59E0B', 1)
            `);
            console.log('[Seed] tbl_service_types OK');
        }
    } catch (e) { console.warn('[Seed] tbl_service_types:', e); }

    await execute(`ALTER TABLE tbl_service_slots ADD COLUMN abertura_em TEXT`).catch(() => {});
    await execute(`ALTER TABLE tarefas ADD COLUMN agendamento_id TEXT`).catch(() => {});
    await execute(`CREATE INDEX IF NOT EXISTS idx_service_slots_abertura ON tbl_service_slots(abertura_em)`).catch(() => {});
    await execute(`CREATE INDEX IF NOT EXISTS idx_tarefas_agendamento    ON tarefas(agendamento_id)`).catch(() => {});
    // ADR-026: rastreabilidade de origem (demanda/agendamento/manifestacao/suite/manual)
    await execute(`ALTER TABLE tarefas ADD COLUMN origem_tipo TEXT`).catch(() => {});
    await execute(`ALTER TABLE tarefas ADD COLUMN origem_id   TEXT`).catch(() => {});
    await execute(`CREATE INDEX IF NOT EXISTS idx_tarefas_origem ON tarefas(origem_tipo, origem_id)`).catch(() => {});

    await execute(`
        CREATE TABLE IF NOT EXISTS tbl_agendamentos (
            id               TEXT PRIMARY KEY,
            slot_id          TEXT NOT NULL REFERENCES tbl_service_slots(id),
            service_type_id  TEXT NOT NULL REFERENCES tbl_service_types(id),
            cliente_id       TEXT NOT NULL,
            cliente_nome     TEXT NOT NULL,
            vagas_solicitadas INTEGER NOT NULL DEFAULT 1,
            bairro           TEXT,
            dados_formulario TEXT NOT NULL DEFAULT '{}',
            status           TEXT NOT NULL DEFAULT 'pendente'
                               CHECK(status IN ('pendente','confirmado','realizado','cancelado')),
            task_id          TEXT,
            cliente_email    TEXT,
            cliente_telefone TEXT,
            responsavel_id   TEXT,
            setor_id         TEXT,
            criado_por       TEXT NOT NULL,
            criado_em        TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em    TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_agendamentos_slot    ON tbl_agendamentos(slot_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente ON tbl_agendamentos(cliente_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_agendamentos_status  ON tbl_agendamentos(status)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_agendamentos_setor   ON tbl_agendamentos(setor_id)`);
    // Guards para bancos criados antes de colunas adicionadas ao DDL
    await execute(`ALTER TABLE tbl_agendamentos ADD COLUMN cliente_nome TEXT NOT NULL DEFAULT ''`).catch(() => {});
    await execute(`ALTER TABLE tbl_agendamentos ADD COLUMN service_type_id TEXT NOT NULL DEFAULT ''`).catch(() => {});
    await execute(`ALTER TABLE tbl_agendamentos ADD COLUMN vagas_solicitadas INTEGER NOT NULL DEFAULT 1`).catch(() => {});
    await execute(`ALTER TABLE tbl_agendamentos ADD COLUMN bairro TEXT`).catch(() => {});
    await execute(`ALTER TABLE tbl_agendamentos ADD COLUMN task_id TEXT`).catch(() => {});
    await execute(`ALTER TABLE tbl_agendamentos ADD COLUMN cliente_email TEXT`).catch(() => {});
    await execute(`ALTER TABLE tbl_agendamentos ADD COLUMN cliente_telefone TEXT`).catch(() => {});
    await execute(`ALTER TABLE tbl_agendamentos ADD COLUMN responsavel_id TEXT`).catch(() => {});
    await execute(`ALTER TABLE tbl_agendamentos ADD COLUMN setor_id TEXT`).catch(() => {});

    // ADR-042: triggers de validação de status para bancos existentes
    // (CREATE TABLE IF NOT EXISTS com CHECK só protege novas instalações)
    await execute(`
        CREATE TRIGGER IF NOT EXISTS chk_agendamentos_status_insert
        BEFORE INSERT ON tbl_agendamentos
        BEGIN
            SELECT RAISE(ABORT,'status de agendamento inválido')
            WHERE NEW.status NOT IN ('pendente','confirmado','realizado','cancelado');
        END
    `).catch(() => {});
    await execute(`
        CREATE TRIGGER IF NOT EXISTS chk_agendamentos_status_update
        BEFORE UPDATE OF status ON tbl_agendamentos
        BEGIN
            SELECT RAISE(ABORT,'status de agendamento inválido')
            WHERE NEW.status NOT IN ('pendente','confirmado','realizado','cancelado');
        END
    `).catch(() => {});
    await execute(`
        CREATE TRIGGER IF NOT EXISTS chk_slots_status_insert
        BEFORE INSERT ON tbl_service_slots
        BEGIN
            SELECT RAISE(ABORT,'status de slot inválido')
            WHERE NEW.status NOT IN ('rascunho','publicado','encerrado','cancelado');
        END
    `).catch(() => {});
    await execute(`
        CREATE TRIGGER IF NOT EXISTS chk_slots_status_update
        BEFORE UPDATE OF status ON tbl_service_slots
        BEGIN
            SELECT RAISE(ABORT,'status de slot inválido')
            WHERE NEW.status NOT IN ('rascunho','publicado','encerrado','cancelado');
        END
    `).catch(() => {});

    await execute(`
        CREATE TABLE IF NOT EXISTS tbl_agendamento_notificacoes (
            id             TEXT PRIMARY KEY,
            agendamento_id TEXT NOT NULL REFERENCES tbl_agendamentos(id),
            canal          TEXT NOT NULL,
            status         TEXT NOT NULL,
            detalhe        TEXT,
            criado_em      TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_agd_notif_agendamento ON tbl_agendamento_notificacoes(agendamento_id)`);

    // ================================================================
    // MÓDULO: Agendamento (Service Booking Engine)
    // Integra o domínio de agendamento ao sistema dinâmico de módulos
    // ================================================================
    await execute(`
        INSERT OR IGNORE INTO registro_modulos (id, slug, nome, descricao, tipo_entidade, icon, color, prefix, ordem, status, versao, configuracao, config_suite, criado_em, atualizado_em, publicado_em)
        VALUES (
            'mod-agendamento',
            'agendamento',
            'Agendamentos',
            'Gestão de slots de agendamento e bookings de serviços. Cria janelas de tempo por tipo de serviço e converte reservas diretamente em tarefas do Kanban.',
            'tarefa',
            '📅',
            '#3B82F6',
            'AGD',
            20,
            'published',
            1,
            '{}',
            NULL,
            datetime('now'),
            datetime('now'),
            datetime('now')
        )
    `);

    // Permissões base do módulo de agendamento
    await execute(`
        INSERT OR IGNORE INTO permissoes_modulos (module_id, profile, can_view, can_create, can_edit, can_approve, can_delete)
        VALUES ('mod-agendamento', 'admin', 1, 1, 1, 1, 1)
    `);
    await execute(`
        INSERT OR IGNORE INTO permissoes_modulos (module_id, profile, can_view, can_create, can_edit, can_approve, can_delete)
        VALUES ('mod-agendamento', 'gerente', 1, 1, 1, 1, 0)
    `);
    await execute(`
        INSERT OR IGNORE INTO permissoes_modulos (module_id, profile, can_view, can_create, can_edit, can_approve, can_delete)
        VALUES ('mod-agendamento', 'operador', 1, 1, 0, 0, 0)
    `);
    await execute(`
        INSERT OR IGNORE INTO permissoes_modulos (module_id, profile, can_view, can_create, can_edit, can_approve, can_delete)
        VALUES ('mod-agendamento', 'campo', 1, 0, 0, 0, 0)
    `);

    // Visuais padrão do módulo de agendamento
    await execute(`
        INSERT OR IGNORE INTO visuais_modulos (id, module_id, visual_type, name, config, is_default, user_id, parent_view_id, sync_status, position, criado_em, atualizado_em)
        VALUES (
            'vis-agd-slots',
            'mod-agendamento',
            'table',
            'Slots de Agendamento',
            '{"source": "tbl_service_slots", "columns": ["titulo", "tipo_prazo", "data_inicio", "data_fim", "capacidade", "vagas_ocupadas", "status"], "filterable": true}',
            1,
            NULL,
            NULL,
            'synced',
            0,
            datetime('now'),
            datetime('now')
        )
    `);
    await execute(`
        INSERT OR IGNORE INTO visuais_modulos (id, module_id, visual_type, name, config, is_default, user_id, parent_view_id, sync_status, position, criado_em, atualizado_em)
        VALUES (
            'vis-agd-bookings',
            'mod-agendamento',
            'table',
            'Bookings',
            '{"source": "tarefas", "filter": "origem = ''booking''", "columns": ["titulo", "status", "prazo", "atribuido_para", "criado_em"], "filterable": true}',
            0,
            NULL,
            NULL,
            'synced',
            1,
            datetime('now'),
            datetime('now')
        )
    `);
    await execute(`
        INSERT OR IGNORE INTO visuais_modulos (id, module_id, visual_type, name, config, is_default, user_id, parent_view_id, sync_status, position, criado_em, atualizado_em)
        VALUES (
            'vis-agd-kanban',
            'mod-agendamento',
            'kanban',
            'Kanban de Agendamentos',
            '{"source": "tarefas", "filter": "origem = ''booking''", "groupBy": "status", "columns": ["titulo", "prazo", "atribuido_para"]}',
            0,
            NULL,
            NULL,
            'synced',
            2,
            datetime('now'),
            datetime('now')
        )
    `);

    console.log('[Bootstrap] Módulo de agendamento registrado');

    // ================================================================
    // Legado: índice parcial de unicidade para ordem ativa em rotas
    // ================================================================
    try {
        await execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tblRotas_ordem_ativa
            ON rotas (idRoteiro, Ordem) WHERE Inativo = 0`);
    } catch (e) {
        // tabela legada pode não existir — silencioso
    }

    // ================================================================
    // Migração: renomeia criado_em → created_at em tarefas_anexos
    // ================================================================
    try {
        await execute(`ALTER TABLE tarefas_anexos RENAME COLUMN criado_em TO created_at`);
    } catch (e) {
        // coluna já renomeada ou não existe — silencioso
    }

    // ================================================================
    // ADR-025: Cache local de binários e referências por entidade
    // ================================================================
    await execute(`
        CREATE TABLE IF NOT EXISTS anexos_cache (
            hash        TEXT PRIMARY KEY,
            local_path  TEXT NOT NULL,
            mime_type   TEXT,
            size_bytes  INTEGER NOT NULL,
            ref_count   INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            accessed_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);

    await execute(`
        CREATE TABLE IF NOT EXISTS anexos_refs (
            hash        TEXT NOT NULL REFERENCES anexos_cache(hash),
            domain      TEXT NOT NULL,
            entity_id   TEXT NOT NULL,
            field_key   TEXT NOT NULL DEFAULT '',
            filename    TEXT NOT NULL,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (hash, domain, entity_id, field_key)
        )
    `);

    await execute(`CREATE INDEX IF NOT EXISTS idx_anexos_refs_entity ON anexos_refs(domain, entity_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_anexos_cache_refcount ON anexos_cache(ref_count) WHERE ref_count <= 0`);

    // ================================================================
    // 19. GEOPROCESSAMENTO — Terrenos e Camadas Geográficas (ADR-038)
    // ================================================================

    await execute(`
        CREATE TABLE IF NOT EXISTS terrenos (
            id               TEXT PRIMARY KEY,
            nome             TEXT NOT NULL,
            codigo_cadastral TEXT,
            tipo             TEXT NOT NULL DEFAULT 'residencial'
                                 CHECK(tipo IN ('residencial','comercial','industrial','publico','rural','outro')),
            geojson          TEXT NOT NULL,
            centroid_lat     REAL,
            centroid_lng     REAL,
            area_m2          REAL,
            bairro           TEXT,
            logradouro       TEXT,
            numero           TEXT,
            cidade           TEXT,
            estado           TEXT,
            observacoes      TEXT,
            ativo            INTEGER NOT NULL DEFAULT 1,
            criado_por       TEXT REFERENCES usuarios(id),
            criado_em        TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em    TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_terrenos_codigo   ON terrenos(codigo_cadastral)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_terrenos_tipo     ON terrenos(tipo)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_terrenos_centroid ON terrenos(centroid_lat, centroid_lng)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_terrenos_ativo    ON terrenos(ativo)`);

    // Guards — referências de terreno em clientes e roteiros
    await execute(`ALTER TABLE clientes ADD COLUMN terreno_id TEXT REFERENCES terrenos(id)`).catch(() => {});
    await execute(`ALTER TABLE roteiro_clientes ADD COLUMN terreno_id TEXT REFERENCES terrenos(id)`).catch(() => {});

    // ── ADR-040: Colunas bbox + R-Tree para viewport-based loading ──
    await execute(`ALTER TABLE terrenos ADD COLUMN bbox_min_lng REAL`).catch(() => {});
    await execute(`ALTER TABLE terrenos ADD COLUMN bbox_min_lat REAL`).catch(() => {});
    await execute(`ALTER TABLE terrenos ADD COLUMN bbox_max_lng REAL`).catch(() => {});
    await execute(`ALTER TABLE terrenos ADD COLUMN bbox_max_lat REAL`).catch(() => {});

    await execute(`
        CREATE VIRTUAL TABLE IF NOT EXISTS terrenos_rtree USING rtree(
            id,
            min_lng, max_lng,
            min_lat, max_lat
        )
    `);

    // ================================================================
    // 19b. CAMADAS GEOGRÁFICAS GENÉRICAS — Mapa de Logística
    // ================================================================
    await execute(`
        CREATE TABLE IF NOT EXISTS geo_layers (
            id           TEXT PRIMARY KEY,
            nome         TEXT NOT NULL,
            tipo         TEXT NOT NULL DEFAULT 'geojson'
                             CHECK(tipo IN ('geojson','kml','gpx')),
            categoria    TEXT DEFAULT 'outro'
                             CHECK(categoria IN ('terreno','pontos_gps','infraestrutura','outro')),
            geojson      TEXT,
            storage_path TEXT,
            cor          TEXT NOT NULL DEFAULT '#3B82F6',
            visivel      INTEGER NOT NULL DEFAULT 1,
            criado_por   TEXT REFERENCES usuarios(id),
            criado_em    TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_geo_layers_visivel   ON geo_layers(visivel)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_geo_layers_categoria ON geo_layers(categoria)`);

    // ================================================================
    // ADR-043: Tabela ecopontos — criação se ainda não existe
    // ================================================================
    await execute(`
        CREATE TABLE IF NOT EXISTS ecopontos (
            id            TEXT PRIMARY KEY,
            nome          TEXT NOT NULL,
            endereco      TEXT,
            setor_id      TEXT REFERENCES setores(id),
            ativo         INTEGER NOT NULL DEFAULT 1,
            criado_em     TEXT NOT NULL DEFAULT (datetime('now')),
            atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_ecopontos_ativo    ON ecopontos(ativo)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_ecopontos_setor_id ON ecopontos(setor_id)`);

    // ================================================================
    // ADR-037: escala_id — ADD COLUMN guard para bancos existentes
    await execute(`ALTER TABLE usuarios ADD COLUMN escala_id TEXT REFERENCES escalas(id)`).catch(() => {});

    // ================================================================
    // ADR-037: log_acesso_turno — auditoria de sessão por turno
    // ================================================================
    await execute(`
        CREATE TABLE IF NOT EXISTS log_acesso_turno (
            id                     TEXT PRIMARY KEY,
            usuario_id             TEXT NOT NULL,
            escala_id              TEXT REFERENCES escalas(id),
            tipo                   TEXT NOT NULL
                                     CHECK(tipo IN ('login_ok','login_negado','sessao_expirada','logout_manual')),
            timestamp              TEXT NOT NULL,
            dentro_turno           INTEGER NOT NULL DEFAULT 0,
            turno_inicio_calculado TEXT,
            turno_fim_calculado    TEXT,
            dispositivo_id         TEXT
        )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_log_acesso_usuario  ON log_acesso_turno(usuario_id)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_log_acesso_timestamp ON log_acesso_turno(timestamp)`);
    await execute(`CREATE INDEX IF NOT EXISTS idx_log_acesso_tipo      ON log_acesso_turno(tipo)`);

    // ADR-047: setor_principal_id — ADD COLUMN guard para bancos existentes
    // CREATE TABLE IF NOT EXISTS só aplica em instâncias novas; instâncias
    // existentes precisam do guard explícito.
    // ================================================================
    await execute(`ALTER TABLE usuarios ADD COLUMN setor_principal_id TEXT REFERENCES setores(id)`).catch(() => {});

    // ================================================================
    // MIGRAÇÃO: adicionar 'whatsapp' ao CHECK constraint de envios_resposta
    // SQLite não suporta ALTER TABLE ... ALTER CHECK; recrea a tabela.
    // Idempotente: verifica se 'whatsapp' já é aceito.
    // ================================================================
    try {
        const rows = await query<{ ok: number }>(
            `SELECT CASE WHEN INSTR(sql, "'whatsapp'") > 0 THEN 1 ELSE 0 END AS ok
             FROM sqlite_master WHERE type = 'table' AND name = 'envios_resposta'`
        );
        if (rows[0]?.ok === 0) {
            await execute(`ALTER TABLE envios_resposta RENAME TO envios_resposta_old`);
            await execute(`
                CREATE TABLE envios_resposta (
                    id              TEXT PRIMARY KEY,
                    resposta_id     TEXT NOT NULL REFERENCES respostas(id) ON DELETE CASCADE,
                    manifestacao_id TEXT NOT NULL REFERENCES manifestacoes(id) ON DELETE CASCADE,
                    canal           TEXT NOT NULL CHECK(canal IN ('email','whatsapp','portal','impresso')),
                    destinatario    TEXT,
                    status_envio    TEXT NOT NULL DEFAULT 'pendente'
                                      CHECK(status_envio IN ('pendente','enviado','falha')),
                    data_envio      TEXT,
                    erro            TEXT
                )
            `);
            await execute(`
                INSERT INTO envios_resposta (id, resposta_id, manifestacao_id, canal, destinatario, status_envio, data_envio, erro)
                SELECT id, resposta_id, manifestacao_id, canal, destinatario, status_envio, data_envio, erro
                FROM envios_resposta_old
            `);
            await execute(`DROP TABLE envios_resposta_old`);
            await execute(`CREATE INDEX IF NOT EXISTS idx_envios_manifestacao ON envios_resposta(manifestacao_id)`);
        }
    } catch { /* tabela ainda não existe — será criada pelo CREATE TABLE IF NOT EXISTS acima */ }

    // ================================================================
    // MIGRAÇÃO: alinhar status de execucao_coleta com StateMachine
    // Valores antigos: pendente/impresso/em_andamento/concluido/cancelado
    // Valores novos:  agendada/em_transito/em_execucao/concluida/cancelada
    // ================================================================
    try {
        const rows = await query<{ ok: number }>(
            `SELECT CASE WHEN INSTR(sql, "'agendada'") > 0 THEN 1 ELSE 0 END AS ok
             FROM sqlite_master WHERE type = 'table' AND name = 'execucao_coleta'`
        );
        if (rows[0]?.ok === 0) {
            await execute(`ALTER TABLE execucao_coleta RENAME TO execucao_coleta_old`);
            await execute(`
                CREATE TABLE execucao_coleta (
                    id                       TEXT PRIMARY KEY,
                    id_despacho              INTEGER,
                    codigo_despacho          TEXT,
                    roteiro_id               TEXT NOT NULL REFERENCES roteiros(id),
                    data_execucao            TEXT NOT NULL,
                    data_impressao           TEXT,
                    status                   TEXT NOT NULL DEFAULT 'agendada'
                                                 CHECK(status IN ('agendada','em_transito','em_execucao','concluida','cancelada')),
                    motorista_id             TEXT REFERENCES usuarios(id),
                    ajudante_id              TEXT REFERENCES usuarios(id),
                    veiculo_placa            TEXT,
                    veiculo_modelo           TEXT,
                    motorista_nome_externo   TEXT,
                    ajudante_nome_externo    TEXT,
                    horario_saida_garagem    TEXT,
                    horario_chegada_previsto TEXT,
                    km_inicial               INTEGER,
                    km_final                 INTEGER,
                    peso_total               REAL,
                    volume_total             REAL,
                    numero_viagens           INTEGER,
                    observacoes              TEXT,
                    inicio_em                TEXT,
                    fim_em                   TEXT,
                    criado_em                TEXT NOT NULL DEFAULT (datetime('now')),
                    atualizado_em            TEXT NOT NULL DEFAULT (datetime('now'))
                )
            `);
            await execute(`
                INSERT INTO execucao_coleta (id, id_despacho, codigo_despacho, roteiro_id, data_execucao, data_impressao,
                    status, motorista_id, ajudante_id, veiculo_placa, veiculo_modelo,
                    motorista_nome_externo, ajudante_nome_externo, horario_saida_garagem, horario_chegada_previsto,
                    km_inicial, km_final, peso_total, volume_total, numero_viagens, observacoes,
                    inicio_em, fim_em, criado_em, atualizado_em)
                SELECT id, id_despacho, codigo_despacho, roteiro_id, data_execucao, data_impressao,
                    CASE status
                        WHEN 'pendente' THEN 'agendada'
                        WHEN 'impresso' THEN 'em_transito'
                        WHEN 'em_andamento' THEN 'em_execucao'
                        WHEN 'concluido' THEN 'concluida'
                        WHEN 'cancelado' THEN 'cancelada'
                        ELSE status
                    END,
                    motorista_id, ajudante_id, veiculo_placa, veiculo_modelo,
                    motorista_nome_externo, ajudante_nome_externo, horario_saida_garagem, horario_chegada_previsto,
                    km_inicial, km_final, peso_total, volume_total, numero_viagens, observacoes,
                    inicio_em, fim_em, criado_em, atualizado_em
                FROM execucao_coleta_old
            `);
            await execute(`DROP TABLE execucao_coleta_old`);
            await execute(`CREATE INDEX IF NOT EXISTS idx_execucao_coleta_despacho  ON execucao_coleta(id_despacho)`);
            await execute(`CREATE INDEX IF NOT EXISTS idx_execucao_coleta_roteiro   ON execucao_coleta(roteiro_id)`);
            await execute(`CREATE INDEX IF NOT EXISTS idx_execucao_coleta_data      ON execucao_coleta(data_execucao)`);
            await execute(`CREATE INDEX IF NOT EXISTS idx_execucao_coleta_status    ON execucao_coleta(status)`);
        }
    } catch { /* tabela ainda não existe */ }

    // ================================================================
    // LGPD: Retenção de dados — limpeza de registros expirados (ADR-021)
    // ================================================================
    // fila_eventos_sync enviados > 90 dias
    await execute(`DELETE FROM fila_eventos_sync WHERE situacao = 'sent' AND criado_em < datetime('now', '-90 days')`).catch(() => {});
    // log_auditoria > 2 anos
    await execute(`DELETE FROM log_auditoria WHERE criado_em < datetime('now', '-2 years')`).catch(() => {});

    console.log('[Bootstrap] Database bootstrap complete');
}
