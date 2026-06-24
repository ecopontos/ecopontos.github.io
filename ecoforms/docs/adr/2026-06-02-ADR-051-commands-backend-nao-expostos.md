# ADR-051: Commands de backend implementados mas não expostos ao frontend

**Data:** 2026-06-02
**Status:**Implementado** (key_rotation → opção A + UI; seed_default_admin → boot Rust)
**Autores:** Equipe EcoForms
**Escopo da auditoria:** `src-tauri/src/lib.rs` (`generate_handler`), `src-tauri/src/commands/mod.rs`, `commands/key_rotation.rs`, `commands/setup.rs`, todos os `invoke()` do frontend (`desktop/**/*.{ts,tsx}`), `scripts/ensure-columns.ts`, `desktop/migrations/011_add_key_escrow.sql`
**ADRs relacionados:** ADR-021 (LGPD/conformidade), ADR-020 (granular sync index), ADR-023 (RBAC)

---

## Contexto

A fronteira real entre backend e frontend neste app Tauri é o conjunto de `#[tauri::command]` registrados no `invoke_handler` de `lib.rs`. Um command só é alcançável pelo frontend (`invoke('nome')`) se aparecer no array `tauri::generate_handler![...]`. Esta auditoria cruzou **todos os commands definidos no Rust** contra **o array de registro** e contra **todos os `invoke()` do frontend**, para responder à pergunta: *o backend está completamente exposto ao frontend?*

Resposta: **não**. A maior parte da superfície está corretamente exposta e consumida, mas há **4 commands implementados que nunca entram no `generate_handler`** — entre eles um módulo inteiro de segurança (rotação/recuperação de chave de sync) que está completo no backend mas é inalcançável pela UI. Há ainda um agravante de schema que tornaria esse módulo não-funcional mesmo se fosse registrado.

---

## Mapa da fronteira backend ↔ frontend

```
src-tauri/src/lib.rs : generate_handler![ ... ]   (33 commands registrados)
  ├── database::{db_connect, db_disconnect, db_get_path, db_query,
  │              db_execute, db_execute_batch, db_last_insert_id, db_export_for_mobile}  ✅
  ├── session::{set_session, clear_session, get_session}                                  ✅
  ├── commands::actions::{suite_approve, suite_reject, demanda_aceitar,
  │                       demanda_encerrar, ecoponto_agendar_remocao}                     ✅
  ├── {verify_password, hash_password, toggle_devtools}                                   ✅
  ├── network::{network_probe_path, network_list_parquet, network_write_parquet, fetch_cep} ✅
  ├── supabase_admin::{supabase_admin_query, supabase_admin_status}                        ✅
  ├── commands::crypto::{load_crypto_key, encrypt_payload, decrypt_payload}               ✅
  ├── commands::setup::create_first_admin                                                 ✅
  ├── commands::email::{save_email_config, get_email_config, send_email, test_email_connection} ✅
  ├── commands::lan_storage::{lan_read_file, lan_write_file, lan_list_dir}                ✅
  └── commands::sync_roteiros::{sync_roteiros_externos, sync_roteiros_status}             ✅

DEFINIDOS no Rust mas AUSENTES do generate_handler:
  ├── commands::key_rotation::rotate_sync_salt        ❌ órfão
  ├── commands::key_rotation::recover_sync_salt       ❌ órfão
  ├── commands::key_rotation::list_salt_history       ❌ órfão
  └── commands::setup::seed_default_admin             ❌ órfão
```

O módulo `key_rotation` é declarado em `commands/mod.rs:6` (`pub mod key_rotation;`) — ou seja, compila e é linkado — mas nenhum dos seus 3 commands é registrado.

---

## Gaps Detalhados

### Gap 1 — Módulo `key_rotation` completo porém inalcançável (Crítico — Funcionalidade morta / Segurança)

**Arquivos:** `commands/key_rotation.rs:67,111,153`, ausência em `lib.rs:78–116`

O módulo implementa o ciclo completo de **rotação e recuperação de chave de sync com escrow** (AES-256-GCM + key stretching de 100k iterações, espelhando o PBKDF2 do frontend):

```rust
#[tauri::command]
pub fn rotate_sync_salt(db_path, user_id, recovery_passphrase, reason) -> Result<String, String>
//   gera novo salt, cifra o antigo com a passphrase de recuperação,
//   grava em sync_salt_history (escrow) e atualiza usuarios.sal_sync

#[tauri::command]
pub fn recover_sync_salt(db_path, user_id, recovery_passphrase) -> Result<String, String>
//   percorre o histórico, decifra com a passphrase, valida hash de integridade
//   e restaura o salt no usuário

#[tauri::command]
pub fn list_salt_history(db_path, user_id) -> Result<Vec<serde_json::Value>, String>
//   lista o histórico de rotações (id, hash, replaced_at, replaced_by, reason)
```

**Nenhum desses commands aparece no `generate_handler`, e o frontend não tem nenhum `invoke('rotate_sync_salt' | 'recover_sync_salt' | 'list_salt_history')`.** A busca por esses nomes em `desktop/**/*.{ts,tsx}` retorna zero ocorrências.

Consequência:
- A feature de rotação de chave (relevante para LGPD / resposta a incidente — invalidar uma chave comprometida sem perder o histórico cifrado) **existe inteiramente no backend mas é impossível de acionar**.
- Não há UI/admin que dispare a rotação ou a recuperação. É código de segurança morto do ponto de vista do produto.

---

### Gap 2 — Tabela `sync_salt_history` fora do schema canônico (Crítico — Runtime Error)

**Arquivos:** `desktop/migrations/011_add_key_escrow.sql:4`, ausência em `scripts/ensure-columns.ts`

Os 3 commands de `key_rotation` dependem da tabela `sync_salt_history`. Essa tabela é criada **apenas** em `desktop/migrations/011_add_key_escrow.sql`:

```sql
CREATE TABLE IF NOT EXISTS sync_salt_history ( ... );
CREATE INDEX IF NOT EXISTS idx_salt_history_user ON sync_salt_history(user_id, replaced_at DESC);
```

Porém o CLAUDE.md define `scripts/ensure-columns.ts` como **"única fonte de verdade do schema"**, executado automaticamente no boot via `container.ts`. A tabela `sync_salt_history` **não está** em `ensure-columns.ts`, e não há evidência de que os arquivos em `desktop/migrations/*.sql` sejam aplicados no boot.

Consequência: mesmo que os commands do Gap 1 fossem registrados, `rotate_sync_salt`/`recover_sync_salt`/`list_salt_history` falhariam em runtime com `no such table: sync_salt_history` em qualquer instalação que só rodou `ensure-columns.ts`.

> Observação correlata: o schema (`ensure-columns.ts:172`) define a coluna como `sal_sync TEXT` — e o código Rust usa `sal_sync`, então estão consistentes entre si. Note que o CLAUDE.md descreve essa coluna como `sync_salt`; a documentação está desatualizada em relação ao schema real, mas isso **não** é o bug (o code↔schema batem).

---

### Gap 3 — `seed_default_admin` implementado mas não exposto nem chamado (Médio)

**Arquivo:** `commands/setup.rs:102`, ausência em `lib.rs:78–116`

```rust
/// Semeia o admin padrão (admin/admin) na primeira instalação.
/// Só funciona quando usuarios está vazia. Idempotente.
#[tauri::command]
pub fn seed_default_admin(state: State<'_, DbState>) -> Result<CreateFirstAdminResult, String>
```

O command é idempotente e seguro (no-op se já existe admin), mas:
- **não está no `generate_handler`** → o frontend não pode chamá-lo;
- **não é chamado internamente** por nenhum outro command Rust (não há `seed_default_admin(...)` em outro ponto do crate);
- apenas `create_first_admin` (o fluxo interativo de criação do primeiro admin) está exposto e em uso.

Consequência: se a intenção era garantir um admin padrão no primeiro boot (bootstrap headless / seed automático), esse caminho está desconectado — é decisão de produto se isso é desejado.

---

## O que está correto (não tocar)

- **Todos os 33 commands registrados estão implementados** — não há registro apontando para command inexistente.
- **O frontend não chama nenhum command inexistente.** O scan de `invoke()` levantou nomes como `execute_sql`, `open_db`, `get_data`, `login`, `add`, `do_something_with_position/size` — todos confirmados como **falsos positivos do regex** (não correspondem a nenhum `invoke('nome')` real no código; provêm de exemplos/strings em outros contextos).
- A sanitização em `db_query`/`db_execute`/`db_execute_batch` (bloqueio de `password_hash` e de mutações em tabelas sensíveis para não-admin) força o uso dos commands dedicados — desenho correto e mantido.

---

## Resumo Executivo

| # | Gap | Severidade | Arquivo(s) | Esforço |
|---|-----|-----------|-----------|---------|
| 1 | Módulo `key_rotation` (3 commands) ausente do `generate_handler` + sem UI | Crítico | `commands/key_rotation.rs`, `lib.rs` | Médio (registro trivial; UI média) |
| 2 | Tabela `sync_salt_history` fora do schema canônico | Crítico | `migrations/011_add_key_escrow.sql`, `scripts/ensure-columns.ts` | Baixo |
| 3 | `seed_default_admin` não exposto nem chamado | Médio | `commands/setup.rs`, `lib.rs` | Trivial |

---

## Decisão / Proposta de Correção

A decisão central é definir **a intenção de produto** de cada command órfão antes de wirá-lo, para não expor superfície de ataque sem necessidade. Proposta:

### Decisão para Gap 1 + Gap 2 (rotação de chave)

Escolher uma das duas direções:

- **A (ativar a feature — preferida se a rotação de chave é requisito LGPD/segurança):**
  1. Portar a DDL de `sync_salt_history` (e seu índice) de `migrations/011_add_key_escrow.sql` para `scripts/ensure-columns.ts` (bloco `CREATE TABLE IF NOT EXISTS`) e replicar em `docs/db/schema_consolidado_corrigido.sql` — conforme a regra de "schema em dois lugares" do CLAUDE.md.
  2. Registrar os 3 commands no `generate_handler` (`lib.rs`):
     ```rust
     commands::key_rotation::rotate_sync_salt,
     commands::key_rotation::recover_sync_salt,
     commands::key_rotation::list_salt_history,
     ```
  3. Adicionar UI de admin (`app/admin/...`) que faça os `invoke()` correspondentes, protegida por `perfil=admin` (idealmente os próprios commands devem revalidar sessão + perfil + `log_audit`, como os demais commands críticos — hoje eles **não** validam sessão).

- **B (arquivar a feature — se rotação de chave não está no roadmap):** mover `commands/key_rotation.rs` e `migrations/011_add_key_escrow.sql` para uma pasta `_deprecated/` e remover `pub mod key_rotation;` de `mod.rs`, deixando registro explícito de que é código adiado. Evita manter superfície de segurança não testada no binário.

### Decisão para Gap 3 (`seed_default_admin`)

- Se o seed automático é desejado: chamá-lo **no boot do Rust** (não via frontend) logo após `db_connect`, ou registrá-lo no `generate_handler` e dispará-lo em `container.ts` no primeiro boot.
- Caso contrário: remover o command para reduzir superfície, mantendo apenas `create_first_admin`.

---

## Ordem de Resolução Recomendada

```
Fase 0 — Decisão (½ dia)
  1. Decidir A vs B para rotação de chave (Gap 1+2) — pergunta de produto/segurança
  2. Decidir destino de seed_default_admin (Gap 3)

Fase 1 — Se A (ativar rotação): (2–3 dias)
  3. Migrar DDL sync_salt_history → ensure-columns.ts + schema_consolidado (Gap 2)
  4. Registrar os 3 commands no generate_handler (Gap 1)
  5. Adicionar validação de sessão+perfil+audit nos commands de key_rotation
  6. UI admin de rotação/recuperação/histórico

Fase 1' — Se B (arquivar): (½ dia)
  3. Mover key_rotation.rs + migration 011 para _deprecated/, remover do mod.rs

Fase 2 — Limpeza (Gap 3)
  7. Aplicar decisão sobre seed_default_admin
  8. Corrigir CLAUDE.md: coluna é sal_sync, não sync_salt
```

---

## Implementação (2026-06-02)

Decisões aplicadas: **Gap 1+2 → opção A-completo + UI**; **Gap 3 → seed no boot (Rust)**.

**Gap 2 — schema canônico**
- `scripts/ensure-columns.ts`: adicionado `CREATE TABLE IF NOT EXISTS sync_salt_history (...)` + `idx_salt_history_user`, junto aos demais blocos de sync. `docs/db/schema_consolidado_corrigido.sql` **não existe mais** (removido na limpeza de docs), então não há doc de referência a sincronizar. `desktop/migrations/011_add_key_escrow.sql` foi mantido como está (idempotente; não é executado no boot).

**Gap 1 — exposição + proteção**
- `commands/key_rotation.rs`: os 3 commands foram refatorados para receber `db: State<DbState>` + `session: State<SessionState>` (em vez de abrir `Connection::open(db_path)`), e agora **revalidam sessão + exigem `system.config` + chamam `log_audit`** (`sync.salt.rotate`, `sync.salt.recover`). `replaced_by` no escrow passou a registrar o ator real da rotação.
- `lib.rs`: `rotate_sync_salt`, `recover_sync_salt`, `list_salt_history` adicionados ao `generate_handler`.
- UI: `app/admin/seguranca/chaves/page.tsx` (seletor de usuário, rotação com passphrase+motivo, recuperação, histórico), protegida por `ProtectedPage permission="system.config"`. Card de acesso adicionado em `app/admin/page.tsx`.

**Gap 3 — seed no boot**
- `commands/setup.rs`: command órfão `seed_default_admin` convertido no helper `seed_default_admin_conn(&Connection)` — tolerante (no-op se a tabela `usuarios` ainda não existe ou se já há usuários) e com `log_audit("system.seed_admin")`.
- `database.rs`: `db_connect` chama o helper após o bootstrap de `sal_sync`. **Ressalva de ordering:** `db_connect` (Rust) roda antes de `ensure-columns.ts` (TS), então em instalação 100% nova o schema ainda não existe no `db_connect` → o seed do admin padrão só efetiva no boot seguinte (o fluxo interativo `create_first_admin` continua cobrindo o primeiro usuário). Em bases que já têm schema (reinstalação/atualização), o seed roda no mesmo boot.

**Verificação:** `npx tsc --noEmit` (frontend) e `cargo check` (src-tauri) — ambos exit 0, sem warnings.

**Follow-up em aberto:** após `recover_sync_salt`, a chave de sync derivada em memória (CryptoState/frontend) não é re-derivada na hora — passa a valer no próximo login/derivação. Avaliar refresh ativo se a recuperação precisar de efeito imediato na sessão corrente.

---

## Relação com ADRs Existentes

- **ADR-021 (LGPD/conformidade):** rotação de chave com escrow é mecanismo típico de resposta a incidente/conformidade — se for requisito, o Gap 1+2 são bloqueadores.
- **ADR-020 (granular sync index):** o `sal_sync` por usuário é insumo da derivação de chave de sync; rotacioná-lo afeta o pipeline de criptografia descrito ali.
- **ADR-023 (RBAC):** os commands de `key_rotation`, ao contrário dos demais commands críticos (`suite_approve`, `demanda_aceitar`, etc.), **não** revalidam sessão/perfil nem chamam `log_audit` — se forem expostos, devem seguir o mesmo padrão de proteção.
```

---

## Addendum (2026-06-11) — Gap 3 revisado: seed dev-only

A `AUDITORIA-2026-06-11.md` reclassificou o seed incondicional de `admin/admin` como achado
**Crítico**: "decisão deliberada não reduz o risco; reduz apenas a surpresa" — uma instalação
release fica acessível com credencial pública conhecida.

**Decisão revisada:** o seed deixa de ser incondicional. `db_connect` (`database.rs:59`) agora só
chama `seed_default_admin_conn` quando `cfg!(debug_assertions) && std::env::var("ECOFORMS_SEED_ADMIN").is_ok()`:

- **Builds release** (`cargo build --release` / `npm run build:tauri`) **nunca** semeiam `admin/admin`,
  independentemente de variáveis de ambiente.
- **Builds debug** só semeiam com opt-in explícito (`ECOFORMS_SEED_ADMIN=1` no ambiente).
- O fluxo `create_first_admin` (tela de primeiro acesso, acionada quando `usuarios` está vazia)
  continua sendo o caminho padrão de bootstrap em qualquer build.

Isso responde a Pergunta em Aberto #2 da AUDITORIA-2026-06-11 no sentido conservador: se algum
deploy real precisar do seed automático (instalação headless), basta setar `ECOFORMS_SEED_ADMIN=1`
explicitamente nesse ambiente — o default passa a ser seguro.
