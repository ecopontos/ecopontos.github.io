# ADR-076 — Auditoria do Backend Local: Achados e Plano de Correção

**Status:** Decidido
**Data:** 2026-06-23
**Relacionado:** ADR-075 (sync P2P), ADR-023 (RBAC), ADR-051 (commands backend)

---

## Contexto

Antes de implementar qualquer sistema de sync (ADR-075), foi realizada uma auditoria completa do backend local (SQLite schema + Rust commands + queries + repositórios + sessão/auth) para avaliar a solidez da fundação.

**Escopo auditado:**
- `scripts/ensure-columns.ts` — schema SQLite (~55 tabelas)
- `src-tauri/src/` — 37 commands Rust (database, session, auth, email, sync, network, supabase_admin)
- `src/infrastructure/persistence/sqlite/queries/` — 29 arquivos de queries SQL
- `src/infrastructure/persistence/sqlite/` — 28 repositórios
- Integridade de dados (FK, PKs, timestamps, UUIDs)
- Modelo de sessão e autenticação

---

## Veredicto

A fundação é **sólida para prosseguir**, mas há **1 item crítico, 6 altos e 9 médios** que devem ser corrigidos antes de produção.

### Pontos fortes confirmados

| Área | Veredicto |
|---|---|
| SQL Injection | **Zero** — `sql_guard.rs` com parser estrutural + prepared statements em 100% do Rust |
| Schema SQLite | Robusto — FK formais, CHECK constraints, índices, triggers de validação, timestamps ISO 8601 |
| Commands protegidos | `demanda_aceitar/encerrar`, `ecoponto_agendar_remocao` validam sessão + permissão + audit |
| Sanitização genérica | `db_query`/`db_execute`/`db_execute_batch` com guards estruturais (tabelas e colunas) |
| Crypto | AES-256-GCM, bcrypt cost 12, HKDF-SHA256, Argon2id para recovery |
| Auditoria | `log_auditoria` + emissão de evento sync em todos os commands críticos |
| Repositórios | 100% via `SqlitePort` (adapter pattern), bind params via array |
| Queries catalogadas | 29 arquivos organizados por domínio, 100% parametrizadas |
| FK enforced | `PRAGMA foreign_keys = ON` no connect |
| WAL mode | `PRAGMA journal_mode = WAL` habilitado |

---

## Achados

### CRÍTICO (bloqueia produção)

#### C1 — Tabela `pacotes` sem PRIMARY KEY formal

**Arquivo:** `scripts/ensure-columns.ts` ~linha 1173
**Problema:** `id INTEGER` declarado sem `PRIMARY KEY`. A unicidade depende do índice `(id_pacote, num_versao)`, mas `id` pode ter duplicatas. Tabela com ~30 colunas, a mais complexa do schema.
**Agravantes:**
- Campos sem NOT NULL que deveriam tê-lo (`id_usuario`)
- Campos duplicados/redundantes (`dados` vs `carga_json`, `tipo_form` vs `tipo_modulo`/`tipo_recurso`)
- Nomes misturam idiomas (`submitted_at`, `ref_id_pacote`, `fechado_em`)

**Correção:** Adicionar `PRIMARY KEY` a `id`. Revisar colunas redundantes e padronizar nomes.

---

### ALTO (corrigir antes de produção)

#### A1 — `unwrap()` em Mutex locks (~15 pontos)

**Arquivos:** `database.rs`, `commands/auth.rs`, `commands/setup.rs`, `commands/sync_roteiros.rs`, `commands/sync_pesagens.rs`, `commands/sync_residuos.rs`
**Problema:** Se um Mutex for envenenado (poisoned) por panic em outra thread, o `unwrap()` causa panic em cascata no backend, travando o app.
**Referência positiva:** `session.rs` e `commands/actions.rs` já usam `.map_err()` corretamente.

**Correção:** Substituir `state.lock().unwrap()` por `state.lock().map_err(|e| format!("lock error: {e}"))` em todos os pontos. Seguir o padrão de `session.rs`.

#### A2 — `send_email` sem validação de sessão/permissão

**Arquivo:** `commands/email.rs` ~linha 146
**Problema:** Verifica sessão apenas para audit log, mas não exige permissão. Qualquer usuário logado pode enviar emails.

**Correção:** Adicionar `validate_session_and_permission()` com permissão `email.send` ou restringir a perfis `admin`/`gerente`.

#### A3 — Commands `sync_*` sem validação de sessão

**Arquivos:** `commands/sync_roteiros.rs`, `commands/sync_pesagens.rs`, `commands/sync_residuos.rs`
**Problema:** Recebem credenciais PostgreSQL diretamente do frontend e executam queries contra banco externo sem verificar se o usuário tem permissão.

**Correção:** Adicionar validação de sessão + permissão `sync.external` ou restringir a admin.

#### A4 — Sessão Rust sem TTL/expiração

**Arquivo:** `src-tauri/src/session.rs`
**Problema:** `validated_at` é armazenado mas NUNCA verificado. Sessão persiste indefinidamente até `clear_session` ou app ser fechado.

**Correção:** Adicionar verificação de TTL em `get_session()`: se `validated_at` > N minutos, re-validar contra banco ou rejeitar. Valor sugerido: 8 horas (um turno de trabalho).

#### A5 — `db_login` retorna dados do usuário com senha incorreta

**Arquivo:** `commands/auth.rs` ~linha 75
**Problema:** Retorna `password_valid: false` mas inclui `user: Some(...)` com todos os dados do usuário (exceto hash). Permite enumeração de dados.

**Correção:** Se `password_valid == false`, retornar `user: None`. O frontend não precisa dos dados se a senha está errada.

#### A6 — `test_email_connection` sem validação de sessão

**Arquivo:** `commands/email.rs` ~linha 207
**Problema:** Nenhuma verificação de sessão ou permissão. Qualquer frontend pode testar conexão SMTP.

**Correção:** Adicionar validação de sessão + perfil admin.

---

### MÉDIO (corrigir antes de produção ou aceitar risco documentado)

#### M1 — Commands `lan_*` sem validação de sessão

**Arquivos:** `commands/lan_storage.rs`
**Problema:** `lan_read_file`, `lan_write_file`, `lan_list_dir` acessíveis sem sessão. Path traversal é validado, mas sem controle de acesso.

**Correção:** Adicionar validação de sessão.

#### M2 — `log_auditoria` e `fila_eventos_sync` não protegidas

**Arquivo:** `src-tauri/src/sql_guard.rs` (lista de tabelas sensíveis)
**Problema:** Um usuário não-admin pode executar `DELETE FROM log_auditoria` ou manipular `fila_eventos_sync` via `db_execute`.

**Correção:** Adicionar `LOG_AUDITORIA`, `FILA_EVENTOS_SYNC`, `LOG_EVENTOS_APLICADOS` à lista de tabelas sensíveis no `sql_guard`.

#### M3 — `tarefas_anexos` e `tarefas_comentarios` sem FK formal

**Arquivo:** `scripts/ensure-columns.ts`
**Problema:** `tarefa_id` sem `REFERENCES tarefas(id) ON DELETE CASCADE`. Risco de dados órfãos se tarefa for deletada (mitigado por soft delete, mas frágil).

**Correção:** Adicionar FK com CASCADE. Como SQLite não suporta `ALTER TABLE ... ADD CONSTRAINT`, requer recriação da tabela (migration pattern já usado em `ensure-columns.ts` para `envios_resposta`).

#### M4 — SHA-256 sem salt aceito como hash alternativo

**Arquivo:** `src-tauri/src/lib.rs` ~linha 20
**Problema:** `check_password` aceita SHA-256 puro (sem salt) como alternativa ao bcrypt. Vulnerável a rainbow tables.

**Correção:** Implementar migração automática: se login com SHA-256 OK, re-hash com bcrypt e atualizar no banco. Após período de transição, remover suporte a SHA-256.

#### M5 — `db_login` não chama `set_session` automaticamente

**Arquivo:** `commands/auth.rs`
**Problema:** O frontend é responsável por chamar `set_session` após `db_login`. Se não fizer, commands não-protegidos ficam acessíveis sem sessão.

**Correção:** `db_login` deve chamar `set_session` internamente quando `password_valid == true`, ou retornar um token que o frontend usa imediatamente.

#### M6 — UUIDs inconsistentes

**Arquivos:** `commands/actions.rs`, `commands/setup.rs`, `src-tauri/src/audit.rs`
**Problema:** Alguns commands usam `format!("{:x}", rand::random::<u128>())` (hex 128 bits) em vez de `uuid::Uuid::new_v4()`. Funcional mas inconsistente — IDs gerados não são UUIDs válidos.

**Correção:** Padronizar em `Uuid::new_v4().to_string()` em todos os pontos de geração de ID no Rust.

#### M7 — Whitelist de tabelas enganosa em `supabase_admin_query`

**Arquivo:** `src-tauri/src/supabase_admin.rs`
**Problema:** Whitelist valida nomes de tabelas locais (`usuarios`, `perfis`, etc.) mas o command faz chamadas para Supabase Auth API (`/auth/v1/admin/users`). Validação semântica incorreta.

**Correção:** Substituir whitelist de tabelas por whitelist de operações (`read_users`, `create_user`, `update_user`, `delete_user`).

#### M8 — `supabase_admin_status` sem validação de sessão

**Arquivo:** `src-tauri/src/supabase_admin.rs`
**Problema:** Retorna info de configuração do Supabase sem verificar login ou perfil.

**Correção:** Adicionar validação de sessão + perfil admin.

#### M9 — `modelos_resposta` definida duas vezes

**Arquivo:** `scripts/ensure-columns.ts` ~linhas 582 e 692
**Problema:** Duas declarações `CREATE TABLE IF NOT EXISTS modelos_resposta` com schemas diferentes. A segunda é no-op, mas gera confusão. Índice referencia campo que só existe na primeira definição.

**Correção:** Remover a definição duplicada.

---

### BAIXO (dívida técnica aceitável)

| # | Problema | Arquivo |
|---|---|---|
| B1 | `demanda_eventos` sem ON DELETE CASCADE | `ensure-columns.ts` |
| B2 | `ecoponto_agendar_remocao` usa hex random em vez de UUID | `actions.rs` |
| B3 | LIMIT por interpolação em `SuiteRepository` (sanitizado, mas anti-pattern) | `SqliteSuiteRepository.ts` |
| B4 | Sem rate limiting em nenhum command Rust | Todos os commands |
| B5 | Interpolação de `perfil` em LIKE (valor controlado, mas anti-pattern) | `SqliteViewRegistryRepository.ts`, `SqliteDecisionRegistryRepository.ts` |

---

## Ordem de correção recomendada

### Bloco 1 — Segurança (antes de produção)

| Prioridade | Item | Esforço |
|---|---|---|
| 1 | A1 — `unwrap()` → `.map_err()` em Mutex locks | Baixo (busca/substitui) |
| 2 | A5 — `db_login` não retornar dados com senha errada | Baixo |
| 3 | A2 + A6 — `send_email` e `test_email_connection` com sessão | Baixo |
| 4 | A3 — `sync_*` com validação de sessão | Baixo |
| 5 | M1 — `lan_*` com validação de sessão | Baixo |
| 6 | M2 — Proteger `log_auditoria` e `fila_eventos_sync` | Baixo (adicionar à lista) |
| 7 | M8 — `supabase_admin_status` com sessão | Baixo |

Esforço total estimado: **~2-3 horas**. Maioria é adição de `validate_session_and_permission()`.

### Bloco 2 — Integridade de dados (antes de produção)

| Prioridade | Item | Esforço |
|---|---|---|
| 8 | C1 — PK formal em `pacotes` | Médio (migration) |
| 9 | M3 — FK em `tarefas_anexos`/`tarefas_comentarios` | Médio (recriação de tabela) |
| 10 | M9 — Remover `modelos_resposta` duplicada | Baixo |

Esforço total estimado: **~2-4 horas**. Migration de `pacotes` requer cuidado.

### Bloco 3 — Robustez (antes de produção ou logo após)

| Prioridade | Item | Esforço |
|---|---|---|
| 11 | A4 — TTL na sessão | Médio |
| 12 | M4 — Migração SHA-256 → bcrypt | Médio |
| 13 | M5 — `db_login` chamar `set_session` | Baixo |
| 14 | M6 — Padronizar UUIDs | Baixo |
| 15 | M7 — Whitelist de operações no supabase_admin | Baixo |

Esforço total estimado: **~3-4 horas**.

### Total estimado: ~7-11 horas de trabalho

---

## Nota sobre o sync pipeline

A auditoria do sync pipeline (realizada separadamente) encontrou **problemas adicionais** que NÃO são escopo deste ADR, pois o pipeline será refeito (ADR-075):

- Bug `SET SET` no `InboundService.ts` — SQL inválido no cursor de sequência
- `ConflictResolver` não usado no desktop (usado apenas no mobile)
- Gap recovery bloqueia rota inteira no desktop (mobile faz quarantine)
- Sem transação atômica no inbound (dispatch + cursor + mark-applied separados)
- Circuit breaker duplicado (desktop tem implementação própria + core)

Esses itens serão endereçados pela nova arquitetura de sync (ADR-075), não por patches no pipeline atual.
