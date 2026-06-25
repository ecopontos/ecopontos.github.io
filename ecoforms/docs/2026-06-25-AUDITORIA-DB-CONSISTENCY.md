# Auditoria de Consistencia do Banco de Dados — 2026-06-25

Auditoria automatizada cruzando schema (`ensure-columns.ts`), queries SQL (repositorios + query catalog + Rust), e modelos de dominio.

---

## CRITICOS — Falhas em Runtime

### C1. `pacotes.ts` — Queries usam nomes de coluna errados (4 queries)

**Arquivo:** `desktop/src/infrastructure/persistence/sqlite/queries/pacotes.ts`

| Query | Coluna usada | Coluna real na tabela `pacotes` |
|---|---|---|
| `PACOTES_FOR_TAREFA` | `s.package_id` | `id_pacote` |
| `PACOTES_FOR_TAREFA` | `s.owner_id` | `id_proprietario` |
| `PACOTES_TIPOS_FORM_DISTINTOS` | `tipo_form` | `tipo_modulo` |
| `PACOTES_TIPOS_FORM_DISTINTOS` | `ativo` | `atual` |
| `PACOTE_BY_ID` | `WHERE id = ?` | `WHERE id_pacote = ?` |

**Impacto:** Queries falham silenciosamente ou retornam resultados vazios.

---

### C2. `system.ts` — AUDIT_LOG_EXPORT usa nomes de coluna errados

**Arquivo:** `desktop/src/infrastructure/persistence/sqlite/queries/system.ts`

| Coluna usada | Coluna real na tabela `log_acoes` |
|---|---|
| `acao` | `id_acao` |
| `entidade` | `tipo_alvo` |
| `id_entidade` | `id_alvo` |

**Impacto:** Exportacao de audit log falha ou retorna colunas NULL.

---

### C3. Rust `ecoponto_agendar_remocao` insere `status = 'todo'`

**Arquivo:** `desktop/src-tauri/src/commands/actions.rs`

O comando insere tarefas com `status = 'todo'`, mas o dominio `TaskStatus` define `'a_fazer'`. Tarefas criadas por este comando ficam **invisiveis** em todas as queries TypeScript (kanban, listagens, filtros).

**Impacto:** Tarefas de agendamento de remocao somem da interface.

---

### C4. `Demanda.mapDemanda` le colunas com nomes errados

**Arquivo:** `desktop/src/infrastructure/persistence/sqlite/SqliteDemandaRepository.ts`

| Campo lido pelo mapper | Coluna real no INSERT |
|---|---|
| `row.arquivo_path` | `caminho_arquivo` |
| `row.archive_status` | `status_arquivo` |

**Impacto:** `arquivoPath` e `archiveStatus` de toda Demanda sao **sempre null** mesmo quando ha dados no banco.

---

## ALTOS — Dados incorretos ou comportamento errado

### A1. Queries de tarefas/projetos usam `created_at`/`updated_at` (EN) em vez de `criado_em`/`atualizado_em` (PT-BR)

| Arquivo | Query | Coluna errada | Coluna correta |
|---|---|---|---|
| `queries/tarefas.ts` | `TAREFA_BY_ID` | `created_at` | `criado_em` |
| `queries/tarefas.ts` | `TAREFAS_RESUMO` | `updated_at` | `atualizado_em` |
| `queries/tarefas.ts` | `TAREFAS_TENDENCIA_DIARIA` | `updated_at` | `atualizado_em` |
| `queries/projetos.ts` | `PROJETO_TAREFAS` | `t.updated_at` | `t.atualizado_em` |
| `queries/projetos.ts` | `PROJETO_EVENTOS` | `e.created_at` | `e.criado_em` |
| `queries/tarefas_anexos.ts` | todas | `created_at` | `criado_em` |

**Impacto:** Filtros por data, ordenacao temporal e tendencia diaria retornam dados incorretos ou vazios.

---

### A2. `SqliteKanbanRepository.findBookingTasksForUser` trata `'arquivado'` como status

**Arquivo:** `desktop/src/infrastructure/persistence/sqlite/SqliteKanbanRepository.ts`

```sql
AND t.status NOT IN ('concluido', 'cancelado', 'arquivado')
```

`'arquivado'` nao e um valor de `TaskStatus` — e um flag booleano na coluna `arquivado` (0/1). Este filtro nao exclui tarefas arquivadas como pretendido.

**Correcao:** Trocar por `AND t.status NOT IN ('concluido', 'cancelado') AND t.arquivado = 0`.

---

### A3. `analysis.ts` referencia colunas que nao existem em `pacotes`

**Arquivo:** `desktop/src/infrastructure/persistence/sqlite/queries/analysis.ts`

Colunas `resumo_usuario`, `resumo_status`, `tipo_form` nao existem na tabela `pacotes`. As colunas corretas sao `id_proprietario`, `status`, `tipo_modulo`.

---

## MEDIOS — Perda de dados em sync ou incompletude

### M1. `Demanda.upsertFromSync` UPDATE nao atualiza `setor_id`

**Arquivo:** `SqliteDemandaRepository.ts`, linhas 113-136

Quando uma Demanda atualizada chega via sync, o `setor_id` alterado e silenciosamente descartado. O INSERT correto inclui `setor_id`.

---

### M2. `toTaskDto` mapper omite 4 campos da entidade

**Arquivo:** `desktop/src/application/task/mappers.ts`

Campos persistidos no banco mas ausentes no DTO:
- `recorrencia`
- `setorId`
- `origemTipo`
- `origemId`

**Impacto:** Qualquer use case ou UI que consome `TaskDto` nunca recebe esses dados.

---

### M3. `ServiceType.toSyncJSON()` omite `abertura_regra`

**Arquivo:** `desktop/src/domain/service/ServiceType.ts`

O campo `aberturaRegra` (coluna `abertura_regra`) e lido/escrito corretamente pelo repositorio, mas nao e incluido no JSON de sync. Regras de abertura de servico sao perdidas durante sincronizacao.

---

### M4. Tabela `modelos_resposta` definida DUAS vezes com schemas diferentes

**Arquivo:** `desktop/scripts/ensure-columns.ts`, linhas 479 e 589

| Campo | 1a definicao (vence) | 2a definicao (ignorada) |
|---|---|---|
| tipo FK | `tipo_manifestacao_id NOT NULL` | `tipo_id REFERENCES tipos_manifestacao(id)` |
| `criado_por` | ausente | `NOT NULL REFERENCES usuarios(id)` |
| `criado_em` | ausente | presente |
| `atualizado_em` | ausente | presente |

A 2a definicao e silenciosamente ignorada pelo `CREATE TABLE IF NOT EXISTS`. Colunas `criado_por`, `criado_em`, `atualizado_em` nunca existirao na tabela real.

---

### M5. Tabela `pacotes` sem PRIMARY KEY

**Arquivo:** `ensure-columns.ts`, linha 1070

A coluna `id INTEGER` nao tem constraint `PRIMARY KEY`. A identidade logica e `id_pacote` + `num_versao` (UNIQUE index), mas `id` e uma coluna INTEGER comum. Codigo que assume `id` como PK pode falhar.

---

### M6. `manifestacoes` — 7 colunas ausentes no CREATE TABLE, so existem via ADD COLUMN

Colunas adicionadas apenas via ADD COLUMN (nao estao no CREATE TABLE):
- `competencia`, `motivo_incompetencia`, `orgao_destino`, `data_competencia`
- `subassunto_id`, `subunidade_id`, `programa_orcamentario_id`

Em bancos novos, essas colunas so existem se os guards de ADD COLUMN executarem com sucesso.

---

### M7. Rust `database.rs` usa nomes de tabela EN; TypeScript usa PT-BR

| Rust (database.rs export) | TypeScript (InboundService) |
|---|---|
| `sync_event_queue` | `fila_eventos_sync` |
| `sync_manifest` | `manifesto_sync` |
| `sync_gap_log` | `log_gaps_sync` |
| `sync_applied_log` | `log_eventos_aplicados` |
| `tbl_audit_log` | `log_auditoria` |

Se nao forem aliases, o export mobile limpa tabelas que nao existem, enquanto as tabelas reais (PT-BR) acumulam dados indefinidamente.

---

### M8. `data-registry.ts` referencia tabela `data_registry`

**Arquivo:** `desktop/src/infrastructure/persistence/sqlite/queries/data-registry.ts`

Algumas queries referenciam `data_registry` enquanto a tabela real e `registro_dados`. Se nao houver alias/view, essas queries falham.

---

### M9. Entidade `Project` e codigo morto

**Arquivo:** `desktop/src/domain/project/Project.ts`

A classe `Project` define logica de dominio (`transitionTo()`, `arquivar()`, `desarquivar()`) mas o `SqliteProjectRepository` nunca a instancia. O repositorio usa `KanbanProject` e `ProjectPatch` diretamente. A entidade tambem nao modela `data_inicio`, `data_fim`, `responsavel_id`, `setor_id` que existem no banco.

---

## BAIXOS — Qualidade de codigo

### B1. FKs ausentes em varias tabelas

Tabelas com colunas de referencia sem FOREIGN KEY constraint:
- `tarefas.projeto_id` → `projetos(id)`
- `tarefas.atribuido_para` → `usuarios(id)`
- `tarefas.criado_por` → `usuarios(id)`
- `tarefas.setor_id` → `setores(id)`
- `tarefas_anexos.tarefa_id` → `tarefas(id)`
- `tarefas_comentarios.tarefa_id` → `tarefas(id)`
- `tbl_agendamentos.cliente_id` → `clientes(id)`
- `historico_pacotes.registro_id` → (sem tabela definida)
- `log_acesso_turno.usuario_id` → `usuarios(id)`
- `pacotes.id_usuario` → `usuarios(id)`

---

### B2. Inconsistencia de naming EN vs PT-BR em timestamps

| Tabela | Coluna usada | Padrao do projeto |
|---|---|---|
| `tarefas_anexos` | `created_at` | `criado_em` |
| `tbl_suite` | `created_at` | `criado_em` |
| `anexos_cache` | `created_at`, `accessed_at` | `criado_em` |
| `anexos_refs` | `created_at` | `criado_em` |
| `sync_salt_history` | `replaced_at` | PT-BR |

---

### B3. `tarefas_interessados` referencia `tarefas` antes da criacao da tabela

No `ensure-columns.ts`, `tarefas_interessados` (linha 1244) faz `REFERENCES tarefas(id)`, mas `tarefas` so e criada na linha 1253. Funciona porque SQLite nao valida FKs no CREATE TABLE, mas e uma inconsistencia de ordenacao.

---

### B4. Seed de `tbl_service_types` referencia `requer_mapa` antes do ADD COLUMN

O INSERT seed inclui `requer_mapa` na lista de colunas, mas essa coluna so e adicionada via ADD COLUMN depois. Em bancos novos, o seed falha silenciosamente (`.catch()`).

---

### B5. Checklist e Notificacao: `SELECT *` retorna snake_case mas interface espera camelCase

Queries com `SELECT c.*` retornam `execucao_id`, `concluido_em`, etc., mas as interfaces TypeScript definem `execucaoId`, `concluidoEm`. Pode resultar em campos `undefined`.

---

## RESUMO POR PRIORIDADE

| Prioridade | Qtd | Descricao |
|---|---|---|
| CRITICO | 4 | Queries que falham em runtime ou criam dados invisiveis |
| ALTO | 3 | Dados incorretos, filtros quebrados, colunas fantasma |
| MEDIO | 9 | Perda de dados em sync, schema duplicado, codigo morto |
| BAIXO | 5 | FKs ausentes, naming inconsistente, ordenacao |

**Total: 21 issues identificados**

---

## PROXIMOS PASSOS RECOMENDADOS

1. **Corrigir C1-C4 imediatamente** — sao bugs em producao
2. **Corrigir A1-A2** — impactam funcionalidades visiveis ao usuario
3. **Adicionar `audit:db` ao CI** — prevenir regressoes de naming
4. **Normalizar naming EN→PT-BR** nos query catalogs e tabelas novas
5. **Consolidar schema `modelos_resposta`** — unificar as duas definicoes
6. **Revisar sync handlers** — garantir que `toSyncJSON()` inclui todos os campos
