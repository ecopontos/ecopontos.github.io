# Auditoria de Consistencia do Banco de Dados — 2026-06-25

Auditoria automatizada cruzando schema (`ensure-columns.ts`), queries SQL (repositorios + query catalog + Rust), e modelos de dominio.

---

## CORRIGIDOS NESTA AUDITORIA

### [CORRIGIDO] C1. `pacotes.ts` — Queries usam nomes de coluna errados

**Arquivo:** `desktop/src/infrastructure/persistence/sqlite/queries/pacotes.ts`
**Status:** Corrigido previamente. `PACOTE_BY_ID` ainda usa `WHERE id = ?` (ver Pendente P1).

---

### [CORRIGIDO] C2. `system.ts` — AUDIT_LOG_EXPORT usa nomes de coluna errados

**Arquivo:** `desktop/src/infrastructure/persistence/sqlite/queries/system.ts`
**Status:** Corrigido previamente. Aliases agora mapeiam colunas corretas.

---

### [CORRIGIDO] C3. Rust `ecoponto_agendar_remocao` insere `status = 'todo'`

**Arquivo:** `desktop/src-tauri/src/commands/actions.rs`
**Status:** Corrigido previamente para usar `'a_fazer'`.

---

### [CORRIGIDO] C4. `Demanda.mapDemanda` — FALSO POSITIVO

**Arquivo:** `desktop/src/infrastructure/persistence/sqlite/SqliteDemandaRepository.ts`
**Status:** Verificado — o mapper le `row.caminho_arquivo` e `row.status_arquivo` corretamente.
O INSERT usa params posicionais que mapeiam `json.arquivo_path` para a coluna `caminho_arquivo` de forma correta.

---

### [CORRIGIDO] A1. Queries de tarefas/projetos usam nomes EN em vez de PT-BR

**Status:** Corrigido previamente nos query catalogs.

---

### [CORRIGIDO] A2. `SqliteKanbanRepository` trata `'arquivado'` como status

**Status:** Verificado — repositorio ja usa `AND t.arquivado = 0` corretamente.

---

### [CORRIGIDO] A3. `analysis.ts` referencia colunas fantasma em `pacotes`

**Status:** Corrigido previamente.

---

### [CORRIGIDO] M1. `Demanda.upsertFromSync` UPDATE nao atualiza `setor_id`

**Arquivo:** `desktop/src/infrastructure/persistence/sqlite/SqliteDemandaRepository.ts`
**Status:** Corrigido — `setor_id` agora incluido no UPDATE (linha 115).

---

### [CORRIGIDO] M4. Tabela `modelos_resposta` definida DUAS vezes com schemas diferentes

**Arquivo:** `desktop/scripts/ensure-columns.ts`
**Status:** Corrigido — 2a definicao substituida por ADD COLUMN guards para `criado_por`, `criado_em`, `atualizado_em`.

---

### [CORRIGIDO] M7. Rust `database.rs` usa nomes de tabela EN no export mobile

**Arquivo:** `desktop/src-tauri/src/database.rs`
**Status:** Corrigido — todos os 8 DELETEs agora usam nomes PT-BR:
- `log_auditoria`, `fila_eventos_sync`, `log_dispositivos_sync`, `log_gaps_sync`
- `cursor_sync`, `manifesto_sync`, `log_eventos_aplicados`, `fila_eventos_lan`

---

### [CORRIGIDO] M8. `data-registry.ts` referencia tabela `data_registry`

**Status:** Verificado — arquivo usa `registro_dados` corretamente.

---

### [CORRIGIDO] B3. `tarefas_interessados` referencia `tarefas` antes da criacao

**Arquivo:** `desktop/scripts/ensure-columns.ts`
**Status:** Corrigido — CREATE TABLE movido para depois de `tarefas`.

---

### [CORRIGIDO] B4. Seed de `tbl_service_types` referencia `requer_mapa` antes do ADD COLUMN

**Arquivo:** `desktop/scripts/ensure-columns.ts`
**Status:** Corrigido — ADD COLUMN para `abertura_regra` e `requer_mapa` movido para antes do seed INSERT.

---

### [CORRIGIDO - NOVO] N1. `logistica.ts` — Queries referenciam tabelas/colunas erradas

**Arquivo:** `desktop/src/infrastructure/persistence/sqlite/queries/logistica.ts`

| Query | Problema | Correcao |
|---|---|---|
| `EXECUCOES_RESUMO` | `FROM execucoes` | `FROM execucao_coleta` |
| `EXECUCOES_POR_ROTEIRO` | `FROM execucoes` | `FROM execucao_coleta` |
| `EXECUCOES_TENDENCIA_MENSAL` | `FROM execucoes` | `FROM execucao_coleta` |
| `INTERCORRENCIAS_POR_TIPO` | `FROM intercorrencias` | `FROM intercorrencias_coleta` + JOIN `tipos_intercorrencia` |
| Todas as de execucao | `'em_andamento'`, `'pendente'` | `'em_execucao'`, `'agendada'` (match CHECK) |

---

### [CORRIGIDO - NOVO] N2. `manifestacoes.ts` — Colunas inexistentes

**Arquivo:** `desktop/src/infrastructure/persistence/sqlite/queries/manifestacoes.ts`

| Query | Coluna errada | Coluna correta |
|---|---|---|
| `MANIFESTACOES_RESUMO` | `m.prazo_resposta` | `m.prazo_limite` |
| `MANIFESTACOES_POR_SETOR` | `m.prazo_resposta` | `m.prazo_limite` |
| `MANIFESTACOES_PRAZO_VENCIDO` | `m.prazo_resposta` | `m.prazo_limite` (com alias `AS prazo_resposta`) |
| `MANIFESTACOES_TEMPO_MEDIO_RESPOSTA` | `m.data_resposta` | `m.encerrado_em` |

---

### [CORRIGIDO - NOVO] N3. `usuarios.ts` — Colunas erradas

**Arquivo:** `desktop/src/infrastructure/persistence/sqlite/queries/usuarios.ts`

| Query | Problema | Correcao |
|---|---|---|
| `USUARIO_DADOS` | `u.username` | `u.nome_usuario` |
| `USUARIOS_SETOR_NOTIFICACAO` | `u.setor_id` | `u.setor_principal_id` |

---

### [CORRIGIDO - NOVO] N4. `projetos.ts` / `tarefas.ts` — `projetos.arquivado` nao existe

| Arquivo | Query | Problema | Correcao |
|---|---|---|---|
| `projetos.ts` | `PROJETO_DETAIL` | `p.arquivado = 0` | `p.arquivado_em IS NULL` |
| `tarefas.ts` | `TAREFAS_POR_PROJETO` | `p.arquivado = 0 OR p.arquivado IS NULL` | `p.arquivado_em IS NULL` |

Tabela `projetos` usa `arquivado_em TEXT` (timestamp), nao flag booleano.

---

### [CORRIGIDO - NOVO] N5. Schema `ensure-columns.ts` — Tabela `app_config` ausente

**Arquivo:** `desktop/scripts/ensure-columns.ts`
**Status:** Adicionado CREATE TABLE para `app_config` (usado por `APP_CONFIG_GET`/`APP_CONFIG_SAVE` em `system.ts`).

---

## PENDENTES — Nao corrigidos nesta sessao

### P1. `PACOTE_BY_ID` usa `WHERE id = ?` — ambiguo

**Arquivo:** `desktop/src/infrastructure/persistence/sqlite/queries/pacotes.ts`
Coluna `id` e `INTEGER` sem PRIMARY KEY. A identidade logica e `id_pacote` + `num_versao`.
**Risco:** Baixo se houver apenas uma coluna `id`, mas semanticamente incorreto.

---

### P2. `toTaskDto` mapper omite 4 campos da entidade

**Arquivo:** `desktop/src/application/task/mappers.ts`
Campos persistidos mas ausentes no DTO: `recorrencia`, `setorId`, `origemTipo`, `origemId`.
**Impacto:** UI nunca recebe esses dados.

---

### P3. `ServiceType.toSyncJSON()` omite `abertura_regra`

**Arquivo:** `desktop/src/domain/service/ServiceType.ts`
Regras de abertura de servico sao perdidas durante sincronizacao.

---

### P4. Tabela `pacotes` sem PRIMARY KEY

**Arquivo:** `ensure-columns.ts`
`id INTEGER` sem constraint `PRIMARY KEY`.

---

### P5. Entidade `Project` e codigo morto

**Arquivo:** `desktop/src/domain/project/Project.ts`
Nunca instanciada pelo repositorio. Nao modela `data_inicio`, `data_fim`, `responsavel_id`, `setor_id`.

---

### P6. `manifestacoes` — 7 colunas existem apenas via ADD COLUMN

Colunas adicionadas apenas por ADD COLUMN (nao estao no CREATE TABLE):
`competencia`, `motivo_incompetencia`, `orgao_destino`, `data_competencia`,
`subassunto_id`, `subunidade_id`, `programa_orcamentario_id`.
**Risco:** Baixo — guards ADD COLUMN sao idemotentes com `.catch(() => {})`.

---

### P7. FKs ausentes em varias tabelas

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

### P8. Inconsistencia de naming EN vs PT-BR em timestamps

| Tabela | Coluna usada | Padrao do projeto |
|---|---|---|
| `tarefas_anexos` | `created_at` | `criado_em` |
| `tbl_suite` | `created_at` | `criado_em` |
| `anexos_cache` | `created_at`, `accessed_at` | `criado_em` |
| `anexos_refs` | `created_at` | `criado_em` |
| `sync_salt_history` | `replaced_at` | PT-BR |

---

### P9. Checklist e Notificacao: `SELECT *` retorna snake_case mas interface espera camelCase

Queries com `SELECT c.*` retornam `execucao_id`, `concluido_em`, etc., mas as interfaces TypeScript definem `execucaoId`, `concluidoEm`.

---

### P10. Tabela `cep` referenciada em `system.ts` mas nao definida no schema

**Arquivo:** `desktop/src/infrastructure/persistence/sqlite/queries/system.ts`
Query `CEP_CACHE_*` referencia tabela `cep` que nao existe em `ensure-columns.ts`.

---

## RESUMO

| Status | Qtd | Descricao |
|---|---|---|
| CORRIGIDO (pre-existente) | 8 | Issues C1-C3, A1-A3, M1, M8 ja estavam corrigidos |
| CORRIGIDO (falso positivo) | 1 | C4 — mapper esta correto |
| CORRIGIDO (esta sessao) | 9 | M4, M7, B3, B4, N1-N5 — schema + queries + Rust |
| PENDENTE | 10 | P1-P10 — melhorias de qualidade e completude |

**Arquivos modificados nesta auditoria:**
- `desktop/scripts/ensure-columns.ts` — 5 correcoes estruturais
- `desktop/src-tauri/src/database.rs` — 8 DELETEs com nomes de tabela corretos
- `desktop/src/infrastructure/persistence/sqlite/queries/logistica.ts` — tabelas e status corrigidos
- `desktop/src/infrastructure/persistence/sqlite/queries/manifestacoes.ts` — 4 colunas corrigidas
- `desktop/src/infrastructure/persistence/sqlite/queries/usuarios.ts` — 2 colunas corrigidas
- `desktop/src/infrastructure/persistence/sqlite/queries/projetos.ts` — filtro `arquivado_em` corrigido
- `desktop/src/infrastructure/persistence/sqlite/queries/tarefas.ts` — filtro `arquivado_em` corrigido

---

## PROXIMOS PASSOS RECOMENDADOS

1. **P10:** Adicionar tabela `cep` ao schema ou remover queries orfas
2. **P2:** Expandir `toTaskDto` para incluir campos omitidos
3. **P3:** Incluir `abertura_regra` no `toSyncJSON()` do `ServiceType`
4. **P4:** Adicionar `PRIMARY KEY` a `pacotes.id` (requer migration)
5. **P7:** Avaliar adicao de FKs (breaking change — requer dados limpos)
6. **P8:** Normalizar timestamps EN→PT-BR nas tabelas restantes
7. **Adicionar `audit:db` ao CI** — prevenir regressoes de naming
