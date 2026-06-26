# Auditoria do Banco SQLite — Tabelas Mortas, Gaps e Incoerências Intrínsecas — 2026-06-25

Auditoria complementar ao doc `2026-06-25-AUDITORIA-DB-CONSISTENCY.md`, cobrindo três eixos solicitados:
**incoerências intrínsecas**, **tabelas mortas** e **gaps** (código ↔ schema). O foco desta rodada são bugs de
runtime **não detectados** na auditoria anterior, além do mapeamento de tabelas mortas.

**Fontes auditadas (schema é a fonte de verdade):**
- Schema canônico: `desktop/scripts/ensure-columns.ts` (`CREATE TABLE IF NOT EXISTS` + `ADD COLUMN` + seed)
- Camada query-only Rust: `desktop/src-tauri/src/database.rs`
- Sync handlers: `desktop/src/infrastructure/sync/HandlerRegistry.ts`
- Repositórios: `desktop/src/infrastructure/persistence/sqlite/Sqlite*Repository.ts`
- Migrations: `desktop/migrations/*.sql`

Todos os achados abaixo foram **verificados** lendo arquivo:linha e cruzando com a definição real da tabela.

> **Atualização 2026-06-25 (commit `6da5e2c`):** os 5 críticos **CR-1..CR-5 foram corrigidos**.
> Verificação por revisão estática (ambiente sem `node_modules` para `tsc`/testes). Tabelas mortas,
> migrations órfãs e incoerências intrínsecas (seções 2–5) **permanecem em aberto**.

---

## RESUMO POR PRIORIDADE

| Prioridade | Qtd | Categoria |
|---|---|---|
| CRÍTICO | 5 | Bugs de runtime confirmados (sync falha / repos falham / dado sensível vaza) |
| MÉDIO | 6 | Tabelas mortas, migrations órfãs |
| BAIXO | 5 | Incoerências intrínsecas (overlap parcial com doc anterior) |

---

## 1. CRÍTICOS — Falhas em runtime (NOVOS, não cobertos antes)

### CR-1. Handler `ecoforms.registro.criado` insere colunas inexistentes — ✅ RESOLVIDO (`6da5e2c`)

**Arquivo:** `desktop/src/infrastructure/sync/HandlerRegistry.ts:133-147`

```sql
INSERT OR REPLACE INTO registro_dados
  (id, tipo, chave, conteudo, setor, criado_por, criado_em, atualizado_em)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
```

A tabela real (`ensure-columns.ts:1057-1065`) tem apenas:

```
id, tipo, chave, conteudo, versao, criado_em, atualizado_em
```

As colunas **`setor`** e **`criado_por`** **não existem** (não há `ALTER TABLE registro_dados` em nenhum lugar).

**Impacto:** **CRÍTICO.** Este é o handler principal de entrada de dados de formulário via sync. Todo evento
`ecoforms.registro.criado` recebido falha com `table registro_dados has no column named setor`. Dados de
formulário sincronizados de outros dispositivos **nunca são persistidos no desktop**.

---

### CR-2. Handler `task.arquivada` atualiza coluna inexistente — ✅ RESOLVIDO (`6da5e2c`)

**Arquivo:** `desktop/src/infrastructure/sync/HandlerRegistry.ts:199-202`

```sql
UPDATE tarefas SET arquivado = 1, arquivado_em = ?, atualizado_em = ? WHERE id = ?
```

A tabela `tarefas` (`ensure-columns.ts:1253-1295`) só tem **`arquivado INTEGER DEFAULT 0`** (linha 1270).
**Não existe `arquivado_em` em `tarefas`** — essa coluna existe em `projetos` (linha 1213, via ADR-012) e em
`pacotes` (linha 1087), não em `tarefas`.

**Impacto:** **CRÍTICO.** Eventos `task.arquivada` recebidos via sync falham (`no such column: arquivado_em`).
Tarefas arquivadas em outro dispositivo nunca são marcadas como arquivadas no desktop.

---

### CR-3. Handler `demanda.encaminhada` atualiza 3 colunas inexistentes — ✅ RESOLVIDO (`6da5e2c`)

**Arquivo:** `desktop/src/infrastructure/sync/HandlerRegistry.ts:225-235`

```sql
UPDATE demandas SET setor_destino = ?, encaminhado_por = ?, encaminhado_em = ?, atualizado_em = ?
WHERE id = ?
```

A tabela `demandas` (`ensure-columns.ts:1372-1398`) tem `aceito_por`, `aceito_em`, `encerrado_por`,
`encerrado_em`, `caminho_arquivo`, `status_arquivo`, `setor_id` — mas **nenhuma** de `setor_destino`,
`encaminhado_por`, `encaminhado_em`.

**Impacto:** **CRÍTICO.** O fluxo de encaminhamento de manifestação/ouvidoria via sync falha silenciosamente.
O estado de encaminhamento nunca é persistido.

---

### CR-4. Repositórios de Views e Decisions consultam tabelas que não existem — ✅ RESOLVIDO (`6da5e2c`)

**Arquivos:**
- `desktop/src/infrastructure/persistence/sqlite/SqliteDecisionRegistryRepository.ts` — consulta
  **`decision_registry`** (linhas 46, 56, 66, 76, 93, 102, 110)
- `desktop/src/infrastructure/persistence/sqlite/SqliteViewRegistryRepository.ts` — consulta
  **`view_registry`** (linhas 37, 46, 55, 71, 79, 87, 92)

O schema define esses dados com nomes **PT-BR**:
- **`registro_decisoes`** (`ensure-columns.ts:1484`)
- **`registro_visualizacoes`** (`ensure-columns.ts:1467`)

As tabelas EN `decision_registry` / `view_registry` **não existem** no schema.

**Impacto:** **CRÍTICO.** Toda leitura/escrita de views e decision trees falha em runtime
(`no such table: view_registry`). Os use cases `GetViewUseCase`, `GetDecisionUseCase`, etc. nunca funcionam.
Caso duplo: as tabelas PT-BR ficam **mortas** (ninguém as usa) e os repos ficam **quebrados** (gap).

---

### CR-5. Limpeza de export usa nomes de tabela obsoletos — dado sensível vaza no backup — ✅ RESOLVIDO (`6da5e2c`)

**Arquivo:** `desktop/src-tauri/src/database.rs:398-405`

Antes de exportar o backup, a função apaga dados sensíveis — mas usa nomes EN obsoletos:

| `DELETE FROM` (código) | Tabela real no schema | Existe? |
|---|---|---|
| `tbl_audit_log` | `log_auditoria` (1439) | ❌ alias inexistente |
| `sync_event_queue` | `fila_eventos_sync` (1529) | ❌ |
| `sync_device_log` | `log_dispositivos_sync` (1630) | ❌ |
| `sync_gap_log` | `log_gaps_sync` (1598) | ❌ |
| `sync_cursor` | `cursor_sync` (1613) | ❌ |
| `sync_manifest` | `manifesto_sync` (1621) | ❌ |
| `sync_status` | *(não existe)* | ❌ |
| `sync_applied_log` | `log_eventos_aplicados` (1568) | ❌ |

Cada `execute(...).ok()` **silencia o erro** de `no such table`. Como nenhuma das tabelas reais é tocada,
o **audit log, a fila de eventos de sync e os manifests permanecem no arquivo de backup exportado**.

**Impacto:** **CRÍTICO (privacidade/LGPD).** O export prometido como "limpo" vaza dados sensíveis de auditoria
e sincronização. O `.ok()` mascara o defeito — nenhum sinal em runtime.

---

## 2. TABELAS MORTAS (definidas no schema, sem nenhum read/write de aplicação)

| Tabela | Definição | Seed | Observação |
|---|---|---|---|
| `anexos_cache` | `ensure-columns.ts:2081` | Não | Cache de binários (ADR-025). Zero referências no código. |
| `anexos_refs` | `ensure-columns.ts:2092` | Não | Refs de anexos por entidade (ADR-025). Depende de `anexos_cache`; ambas mortas. |
| `cursor_sync` | `ensure-columns.ts:1613` | Não | Só aparece (com nome errado `sync_cursor`) no cleanup de `database.rs`. Sem read/write real. |
| `log_dispositivos_sync` | `ensure-columns.ts:1630` | Não | Idem (referido como `sync_device_log` só no export). |
| `registro_decisoes` | `ensure-columns.ts:1484` | Não | Morta **porque** o repo consulta o nome EN inexistente (ver CR-4). |
| `registro_visualizacoes` | `ensure-columns.ts:1467` | Não | Idem CR-4. |

**Recomendação:** decidir, por tabela, entre (a) **remover** do schema (cache de anexos, se a feature foi
abandonada) ou (b) **religar o código ao nome correto** (`registro_decisoes`/`registro_visualizacoes`,
`cursor_sync`, `log_dispositivos_sync` — estas têm consumidores que apontam para o nome errado). As duas de
registry são bug, não código morto de verdade.

---

## 3. MIGRATIONS ÓRFÃS — pasta `migrations/` aparentemente sem runner

Os arquivos `desktop/migrations/007–021/*.sql` definem **tabelas com nomes EN que duplicam** as PT-BR do
`ensure-columns.ts`:

| Migration | Cria (EN) | Equivalente PT-BR no schema canônico |
|---|---|---|
| `007_add_sync_device_log.sql` | `sync_event_queue`, `sync_device_log` | `fila_eventos_sync`, `log_dispositivos_sync` |
| `010_add_module_registry.sql` | `module_registry`, `module_permissions` | `registro_modulos`, `permissoes_modulos` |
| `018_create_module_visual_views.sql` | `module_visual_views` | `visuais_modulos` |
| `019_user_widget_instances.sql` | `user_widget_instances` | `instancias_widgets_usuario` |

**Não foi encontrado nenhum runner** que execute esses `.sql` em runtime: busca negativa em `src-tauri/src/`,
`lib.rs`, `container.ts` por `read_dir`/`readdir`/`migrations`. O comentário em `ensure-columns.ts:1582`
("Migrado de desktop/migrations/011... para o schema canônico") indica que o conteúdo foi **absorvido pelo
`ensure-columns.ts`**.

**Conclusão:** a pasta `migrations/` está **órfã/legada**. Risco em runtime é baixo (não roda), mas é débito
técnico: arquivos mortos + armadilha (se alguém rodar manualmente, cria tabelas EN duplicadas que fragmentam o
banco). **Recomendação:** arquivar/remover a pasta ou documentar explicitamente que não é executada.

---

## 4. INCOERÊNCIAS INTRÍNSECAS DE SCHEMA (overlap com doc anterior — referência cruzada)

Confirmadas nesta rodada; já tratadas no doc `2026-06-25-AUDITORIA-DB-CONSISTENCY.md` (não reabrir, só
cruzar):

| Item | Local | Ref. doc anterior |
|---|---|---|
| `modelos_resposta` definida 2× com schemas diferentes (a 2ª é ignorada por `IF NOT EXISTS`) | `ensure-columns.ts:479` e `:590` | M4 |
| `pacotes` sem `PRIMARY KEY` | `ensure-columns.ts:1070` | M5 |
| Colunas só via `ADD COLUMN`, ausentes do `CREATE TABLE` (`manifestacoes`, `respostas`, `anexos`) — em banco novo dependem do guard | vários | M6 |
| Naming misto de timestamps PT-BR (`criado_em`) vs EN (`created_at`) — `tbl_suite`, `anexos_cache`, `anexos_refs`, `tarefas_anexos` | vários | B2 |
| FKs ausentes onde há coluna `_id` de referência (`tarefas.demanda_id`, `tarefas.suite_id`, `anexos.demanda_id`) | vários | B1 |

---

## 5. STATUS DOS CRÍTICOS DO DOC ANTERIOR (ainda aplicáveis)

Re-verificados e **ainda presentes** no código:
- **C1** — `queries/pacotes.ts` usa nomes de coluna errados (`package_id`/`owner_id`/`tipo_form`/`ativo` vs
  `id_pacote`/`id_proprietario`/`tipo_modulo`/`atual`).
- **C2** — `queries/system.ts` `AUDIT_LOG_EXPORT` usa `acao`/`entidade`/`id_entidade` em vez de
  `id_acao`/`tipo_alvo`/`id_alvo`.
- **C3** — `commands/actions.rs` insere tarefa com `status='todo'` (domínio espera `'a_fazer'`).
- **C4** — `SqliteDemandaRepository` lê `row.arquivo_path`/`row.archive_status` em vez de
  `caminho_arquivo`/`status_arquivo`.

---

## PRÓXIMOS PASSOS RECOMENDADOS

1. **Corrigir CR-1..CR-4 imediatamente** — quebram sync e funcionalidades de views/decisions em runtime.
2. **Corrigir CR-5** — risco de privacidade (LGPD); alinhar nomes em `database.rs:398-405` e considerar trocar
   `.ok()` por log de erro para não mascarar falhas futuras.
3. **Religar ou remover** as tabelas mortas (decidir por tabela; as de registry são bug).
4. **Arquivar `migrations/`** ou documentar que não é executada.
5. **Adicionar verificação `audit:db` ao CI** — parsear `ensure-columns.ts` e validar que toda tabela/coluna
   referenciada em handlers, repositórios, query catalogs e `database.rs` existe no schema. Isso teria pego
   CR-1..CR-5 automaticamente.

---

## RESUMO

**16 achados** — 5 críticos novos (bugs de runtime confirmados), 6 tabelas mortas, migrations órfãs, e 5
incoerências intrínsecas com referência cruzada ao doc de consistência. Os críticos CR-1..CR-5 são bugs reais
de produção que a auditoria anterior (focada em queries/colunas) não cobriu, pois estão em **handlers de sync**,
**repositórios de registry** e **código Rust de export**.
