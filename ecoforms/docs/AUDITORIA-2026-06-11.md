# Auditoria Técnica — EcoForms (monorepo)

**Data:** 2026-06-11 · **Branch:** master @ `d52c7ac` · **Auditor:** revisão técnica principal
**Escopo:** repositório completo (desktop Tauri+Next, mobile Capacitor, packages/core, infra git)
**Regra observada:** nenhum código foi modificado. Cada afirmação cita `arquivo:linha` verificado nesta data.
**Relação com a auditoria anterior:** sucede `AUDITORIA-2026-06-10.md`. Os achados de ontem foram **reverificados independentemente** — esta auditoria registra o que foi de fato resolvido, o que permanece aberto e o que mudou de severidade.

---

> ## ⚠️ ERRATA / ATUALIZAÇÃO DE STATUS — pós-`d52c7ac`
>
> **Adicionado em 2026-06-11.** Este relatório foi escrito sobre `master @ d52c7ac`. Commits **posteriores** já fecharam parte dos achados marcados abaixo como "ABERTO". O corpo do documento (seções 1–7) **não foi reescrito** — vale como retrato de `d52c7ac`. Esta errata registra o que mudou, verificado no `HEAD 4c0411a`.
>
> **Já remediado (não vale mais como aberto):**
>
> | Achado no corpo | Commit | Estado verificado em `4c0411a` |
> |---|---|---|
> | **[CRÍTICA] seed `admin/admin` incondicional no boot** (§1, §3 Segurança, §7) | `8db0952` | ✅ Fechado — `database.rs:61` só semeia com `cfg!(debug_assertions) && std::env::var("ECOFORMS_SEED_ADMIN").is_ok()`; build release nunca semeia |
> | **[CRÍTICA] política de senha só-dígitos** (§1, §3 Segurança, §7) | `8db0952` | ✅ Fechado — `setup.rs:17-24` exige ≥8 caracteres com letras **e** números; a exigência só-dígitos foi removida |
> | **[ALTA] desktop/mobile sem script `test` executável** (§3 Testes, Marco 0.2) | `b1cccee` | ✅ Fechado — `test: "vitest run"` em `desktop/package.json` e `mobile/package.json` |
> | **[MÉDIA] nenhum README no repositório** (§3 Documentação, Marco 3.1) | `4c0411a` | ✅ Fechado — existem `README.md` na raiz, em `desktop/` e em `mobile/` |
>
> Em consequência, o **"Top 3 riscos"** (§1) e o painel **"Delta vs. 2026-06-10"** (§7) estão desatualizados: o risco #1 (auth de produção) foi mitigado e as linhas de seed/senha/test/README da tabela §7 passaram de ❌ para ✅.
>
> **Continua aberto (reverificado em `4c0411a`):**
> - `mobile_standalone/` ainda rastreado (**452 arquivos**) e duplicatas órfãs da raiz (`src/`, `src-tauri/`, `app/`, `js/`, `download/` ≈ **50 arquivos**).
> - `BD_Flex_v2007.sqlite` e `historical.db` ainda rastreados.
> - **Zero CI** — `.github/` contém só `copilot-instructions.md`.
> - **[CRÍTICA-condicional]** rotação da SERVICE_ROLE_KEY ainda não confirmada em docs.
> - **[ALTA]** fallback SHA-256 em `verify_password`, baseline de lint, `innerHTML` ×65 e deps peso-morto do mobile — sem mudança.

---

## 1. Resumo Executivo

**Nota geral: C−** (era D+ em 2026-06-10)

Em 24 horas o repositório melhorou de forma mensurável: a sanitização SQL foi substituída por validação estrutural com testes (`sql_guard.rs`, 26 testes Rust), os 3 arquivos-deus de UI foram decompostos (maior arquivo do desktop caiu de 1513 para 742 linhas), a árvore de trabalho está limpa, e os segredos foram expurgados do histórico. O que segura a nota em C−: **dois achados críticos de autenticação continuam intactos** (seed `admin/admin` no boot e política de senha que *exige* PIN numérico), **zero CI** continua permitindo que os 143 erros de lint existentes cresçam sem freio, e o repo ainda carrega ~470 arquivos de peso morto rastreado (`mobile_standalone/`, `download/` com dados operacionais reais, bancos SQLite, duplicatas na raiz).

A engenharia de domínio segue merecendo B+. A postura de autenticação merece D. A operação de repositório subiu de F para C. Média calibrada para um sistema que lida com dados de cidadãos: **C−**.

### Top 3 riscos
1. **Admin padrão `admin/admin` criado no boot + senha obrigatoriamente numérica de ≥4 dígitos.** `seed_default_admin_conn` (`desktop/src-tauri/src/commands/setup.rs:107-142`) é chamado em todo `db_connect` (`desktop/src-tauri/src/database.rs:59`). `create_first_admin` **rejeita** senhas que não sejam só dígitos (`setup.rs:38-42`). Nota: o seed foi decisão deliberada do ADR-051 (implementado 2026-06-02), mas continua sendo credencial pública conhecida em produção. **Crítico.**
2. **Rotação da SERVICE_ROLE_KEY não confirmada.** O histórico foi expurgado em 2026-06-10, mas não há evidência no repo de que a chave foi rotacionada no dashboard Supabase. Até confirmação, deve-se assumir comprometida. **Crítico (condicional).**
3. **Zero CI/CD com baseline de 143 erros de lint.** `.github/` contém apenas `copilot-instructions.md`; `npx eslint .` no desktop reporta 143 erros / 168 warnings em 85 arquivos; desktop não tem script `test` apesar de ter 19 arquivos de teste e `vitest.config.ts`. Nada impede regressão. **Alto.**

### Top 3 oportunidades
1. **Marco 0 imediato:** GitHub Actions com `eslint` (congelando baseline atual), `vitest run`, `cargo test` — esforço M, destrava todo o resto.
2. **Expurgo dos ~470 arquivos de peso morto rastreado** (`mobile_standalone/` 452, `download/` 14 com placas de veículos, `js/` 19, `src/` 14 e `src-tauri/` 2 duplicados na raiz, `BD_Flex_v2007.sqlite`, `historical.db`) — esforço P/M, reduz superfície de vazamento e confusão.
3. **Fechar os 2 críticos de autenticação** (seed condicional a flag + política de senha real) — esforço P, elimina os únicos achados Críticos restantes de código.

---

## 2. Mapa do Repositório

**Propósito:** Plataforma de formulários e coleta de campo para gestão municipal ambiental (ecopontos, logística de coleta, manifestações de ouvidoria/LGPD, agendamentos, demandas). Dois clientes — desktop operacional (Tauri) e app de campo Android (Capacitor) — compartilham um motor de sync por eventos criptografados sobre Supabase Storage. Maturidade aparente: **ferramenta interna em pré-produção** com disciplina de ADRs incomum (60+).

**Stack (verificada):**
- **Desktop** (`desktop/package.json`): Tauri 2.9.5 (Rust) + Next.js 16.2 / React 19.2 + TypeScript, SQLite via `invoke`, Clean Architecture. 42 deps + 15 devDeps.
- **Mobile** (`mobile/package.json`): Capacitor 8 + Android, JS vanilla em `mobile/www/` (106 arquivos JS), Vitest 3.
- **packages/core** (`ecoforms-core`): lib compartilhada (permissions, sync envelope, utils), build via `tsc`.
- **Rust** (`desktop/src-tauri/Cargo.toml`): rusqlite 0.32 bundled, bcrypt 0.16, aes-gcm 0.10, lettre (SMTP), ureq, **postgres 0.19** (conexão Postgres direta do cliente — usada por `network_write_parquet`/admin).

**Fluxo principal (desktop):** `app/` (App Router) → hooks (`src/interface/hooks/`) → `container.ts` (DI, 610 linhas) → use cases (`src/application/`) → repositórios (`src/infrastructure/persistence/sqlite/`) → `invoke('db_query'/'db_execute')` → Rust `database.rs` (+ `sql_guard.rs`) → SQLite. Mutações sensíveis só por commands dedicados que revalidam sessão+perfil.

**Distribuição de arquivos rastreados (git ls-files):**
| Dir | Arquivos | Descrição |
|---|---:|---|
| `desktop/` | 780 | Cliente Tauri+Next — núcleo do produto |
| `mobile_standalone/` | 452 | **Duplicata legada do mobile, ainda rastreada** |
| `mobile/` | 294 | Cliente Capacitor Android atual |
| `_reversa_sdd/` | 145 | Artefatos do framework Reversa |
| `docs/` | 52 | ADRs, auditorias, schema consolidado |
| `packages/` | 32 | `ecoforms-core` |
| `js/` (raiz) | 19 | **Resto legado** (sqlite-workers, sync antigo) |
| `download/` | 14 | **Dumps operacionais reais** (CSV com placas, formSubmissions, IndexedDB) |
| `src/` (raiz) | 14 | **Duplicatas órfãs de arquivos do desktop** (use cases, repositórios) |
| `src-tauri/` (raiz) | 2 | **Duplicatas órfãs** (`database.rs`, `commands/email.rs`) |
| `app/` (raiz) | 1 | **Duplicata órfã** (`app/login/page.tsx`) |

**O que surpreendeu:**
- *Positivo:* a remediação de ontem foi real — `git ls-files` não retorna nenhum `.env` com valores, nenhum `.keystore`; o working tree está limpo (apenas 2 `test.keystore` untracked, intencionais).
- *Negativo:* o commit de limpeza `86bea5d` **rastreou** as duplicatas órfãs da raiz (`src/`, `src-tauri/`, `app/login/`) em vez de removê-las — o "commit de tudo pendente" institucionalizou lixo.
- *Negativo:* `BD_Flex_v2007.sqlite` (316 KB) e `historical.db` continuam **rastreados** — o `.gitignore` protege apenas arquivos futuros, não remove os já commitados.
- *Negativo:* não existe **nenhum README** — nem na raiz, nem em `desktop/`, nem em `mobile/`. O onboarding depende inteiramente de `CLAUDE.md`/`AGENTS.md` (orientados a agentes, não a humanos).

---

## 3. Relatório de Auditoria

Legenda: (fato) = verificado em arquivo; (julgamento) = avaliação do auditor.

### Segurança

**[CRÍTICA] Admin padrão `admin/admin` semeado em todo boot — ABERTO (inalterado desde ontem)**
- *O quê:* `seed_default_admin_conn` insere usuário `admin` com `bcrypt::hash("admin", 10)` quando `usuarios` está vazia (`desktop/src-tauri/src/commands/setup.rs:107-142`); chamado incondicionalmente em `db_connect` (`desktop/src-tauri/src/database.rs:59-60`).
- *Contexto novo:* o ADR-051 (`docs/Concluidos/2026-06-02-ADR-051-commands-backend-nao-expostos.md:4,99-115`) decidiu **deliberadamente** ligar o seed no boot — o próprio ADR registra que "é decisão de produto se isso é desejado".
- *Por que importa:* instalação fresca em produção fica acessível com credencial pública. Decisão deliberada não reduz o risco; reduz apenas a surpresa.
- *Severidade:* **Crítica.** (fato)

**[CRÍTICA] Política de senha exige PIN numérico**
- *O quê:* `create_first_admin` rejeita senha < 4 chars **e rejeita qualquer caractere não-dígito**: `if !password.chars().all(|c| c.is_ascii_digit()) { return Err("Senha deve conter apenas números.") }` (`setup.rs:38-42`).
- *Por que importa:* não é só permitir senha fraca — é **proibir** senha forte. Espaço de busca de 10⁴–10⁶ para força bruta offline contra o hash bcrypt.
- *Severidade:* **Crítica.** (fato)

**[CRÍTICA-condicional] Rotação da SERVICE_ROLE_KEY não confirmada**
- *O quê:* histórico expurgado em 2026-06-10 (`AUDITORIA-2026-06-10.md` §7), mas `mobile/scripts/sync_remote_db_to_supabase.js:44` ainda contém `const supabaseKey = fallbackKey; // Force the known hardcoded key...` apontando para o placeholder `REDACTED_SERVICE_ROLE_KEY` (linha 37) — o script está quebrado e o *padrão* de hardcode permanece no código.
- *Por que importa:* se a chave antiga não foi rotacionada no dashboard, qualquer clone antigo do repo continua com acesso total ao Postgres.
- *Severidade:* **Crítica até confirmação da rotação; Média depois** (limpar o padrão de fallback). (fato)

**[ALTA] `verify_password` aceita SHA-256 sem salt como fallback — ABERTO (inalterado)**
- *O quê:* `desktop/src-tauri/src/lib.rs:16-28` — hash que não começa com `$2` é comparado como SHA-256 hex puro.
- *Por que importa:* SHA-256 sem salt é quebrável por rainbow table; diverge do mobile, que rejeita hashes não-bcrypt.
- *Severidade:* **Alta.** (fato)

**[MÉDIA→BAIXA] Anon key hardcoded e duplicada em 8 arquivos do mobile**
- *O quê:* JWT `role:anon` (verificado por decode do payload) aparece hardcoded em `mobile/www/index.html`, `login.html`, `dashboard.html`, `data-details-view.html`, `data-table-view.html`, `form-editor.html`, `js/device-setup.js` e `mobile/tests/test-activity-completion.html:135`.
- *Por que importa:* anon key é pública por design (embarca no APK de qualquer forma) — o problema não é vazamento, é **duplicação ×8**: trocar de projeto/ambiente exige editar 8 arquivos; um esquecido aponta silenciosamente para o ambiente errado.
- *Severidade:* **Baixa** (manutenibilidade, não exposição). (fato)

**[MÉDIA] Superfície de XSS via `innerHTML` no mobile — ABERTO (inalterado)**
- *O quê:* 65 atribuições `innerHTML =` em 28 arquivos de `mobile/www/js/` (contagem verificada hoje).
- *Severidade:* **Média** (fato bruto; exploração não confirmada).

**[MÉDIA] Dados operacionais reais rastreados em `download/`**
- *O quê:* `download/atendimentos_ecoponto.csv` contém placas de veículos reais, datas e bairros (linha 2: `"QJC0J43";"28/04/2026";...;"Trindade"`); `formSubmissions.json`, dumps de IndexedDB (`download/indexeddb_leveldb/*.ldb`) e `inserir_erros_supabase.sql` também rastreados.
- *Por que importa:* placa de veículo é dado pessoal sob LGPD; o expurgo de segredos de ontem **não** cobriu esses arquivos.
- *Severidade:* **Média.** (fato)

**[BAIXA] Bancos SQLite ainda rastreados**
- *O quê:* `BD_Flex_v2007.sqlite` e `historical.db` retornam em `git ls-files` (verificado hoje). A auditoria de ontem afirmou que estavam "protegidos por `.gitignore`" — impreciso: `.gitignore` não desrastreia.
- *Severidade:* **Baixa** (conteúdo não inspecionado). (fato)

### ✅ Resolvidos desde 2026-06-10 (verificados)
- **Sanitização SQL estrutural** (commit `e8e1397`): `db_query` agora normaliza (`sql_guard::strip_comments_and_strings`), exige single-statement e rejeita não-SELECT (`database.rs:98-102`); `db_execute`/`db_execute_batch` extraem tabela-alvo com match exato (`database.rs:168-178,207,262-263`). `sql_guard.rs` tem 14 testes + 12 em `database.rs` (26 `#[test]`).
- **Arquivos-deus de UI** (commits `d3c0659`, `229e21e`): `LogisticsMap.tsx` 1086→~155, `manifestacoes/page.tsx` 952→207, `ManifestacaoDetailPage.tsx` 1513→290. Maior arquivo do desktop hoje: `scripts/ensure-columns.ts` (2138, script de schema) e `SchemaEditor.tsx` (742).
- **Segredos fora do tracking e do histórico**: `git ls-files` com filtro `.env|keystore` retorna apenas `.env.example` (2 arquivos). Working tree limpo.
- **Mojibake**: `auth-manager.js` lê como UTF-8 válido hoje (0 sequências corrompidas; "NÃO" e emojis renderizam corretos) — o problema de encoding reportado ontem não se reproduz nos arquivos amostrados.

### Arquitetura e design

**[ALTA] Duplicação `mobile/` vs `mobile_standalone/` — ABERTO (inalterado)**
- *O quê:* 452 arquivos rastreados em `mobile_standalone/` vs 294 em `mobile/`; último commit que o tocou foi `9f9b844`. `CLAUDE.md` descreve apenas `mobile/`.
- *Severidade:* **Alta.** (fato)

**[MÉDIA] Duplicatas órfãs na raiz, agora rastreadas**
- *O quê:* `src/` (14 arquivos — ex.: `src/infrastructure/persistence/sqlite/SqliteTaskRepository.ts`, espelhos de caminhos do desktop), `src-tauri/src/database.rs`, `src-tauri/src/commands/email.rs`, `app/login/page.tsx` — todos na **raiz**, rastreados desde o commit `86bea5d`. Nenhum build os referencia (não estão em nenhum tsconfig/workspace).
- *Por que importa:* parecem código vivo, são fósseis; um grep ou refactor global os encontra e induz erro.
- *Severidade:* **Média.** (fato)

**[MÉDIA] `container.ts` com 610 linhas — ABERTO**
- *O quê:* `desktop/src/infrastructure/container.ts` (610 linhas), único ponto de wiring do DI.
- *Severidade:* **Média** (julgamento — já existe `container/modules/` como padrão de modularização iniciado).

**[BAIXA] Lockfiles aninhados em workspace npm**
- *O quê:* além do `package-lock.json` da raiz, existem locks rastreados em `desktop/`, `mobile/`, `packages/core/` e `meu-supabase-mcp/`. Em npm workspaces, o lock da raiz é a fonte de verdade; locks aninhados indicam `npm install` rodado dentro dos pacotes e podem divergir silenciosamente.
- *Severidade:* **Baixa.** (fato + julgamento)

### Qualidade de código

**[ALTA] Baseline de lint: 143 erros / 168 warnings em 85 arquivos**
- *O quê:* `npx eslint .` no desktop (medido hoje). Inclui erros `react-hooks/*` reais (ex.: `set-state-in-effect`, `static-components` em `app/manifestacoes/novo/page.tsx:67`).
- *Por que importa:* sem gate, o baseline só cresce; erros de hooks são bugs latentes de render, não estilo.
- *Severidade:* **Alta.** (fato)

**[MÉDIA] Arquivos-deus remanescentes no mobile**
- *O quê:* `mobile/www/js/data-service.js` (2345 linhas), `dashboard-service.js` (1973), `device-setup.js` (1893), `smart-cache.js` (1885), `auth-manager.js` (1524).
- *Severidade:* **Média** (julgamento — o padrão de decomposição validado no desktop ainda não chegou ao mobile).

**[BAIXA] Scripts one-off ainda na raiz**
- *O quê:* 8× `rename-*.cjs`, `fix_*.js/.sh`, `create_*.mjs`, `count_tokens.py`, `server.js`, `supabase-config.js`, PS1 diversos — vários **rastreados** (`validate-project.ps1`, `update-css*.ps1`, etc.).
- *Severidade:* **Baixa.** (fato)

### Testes

**[ALTA] Rede de segurança existe mas não é executável por script — parcialmente ABERTO**
- *O quê:* desktop tem 19 arquivos de teste + `vitest.config.ts` + 1 spec Playwright (`desktop/e2e/modulo.spec.ts`), mas **não tem script `test`** no `package.json` (verificado: ausente); o `test:desktop` da raiz aponta para esse script inexistente. Mobile: `"test": "echo \"Error: no test specified\" && exit 1"` (`mobile/package.json`). Rust: 26 testes, executáveis via `cargo test`.
- *Por que importa:* os testes que existem não rodam por convenção nem por gate — só por invocação manual de `npx vitest`.
- *Severidade:* **Alta.** (fato)

### Performance

**[INFO] Crescimento da fila de sync é controlado (achado descartado)**
- *O quê:* a fila `fila_eventos_sync` é deletada após push (`TransportService.ts:104`) e tem prune de 90 dias para enviados (`ensure-columns.ts:2133`). Nenhum crescimento ilimitado verificado nesse caminho.
- (fato — registrado para evitar re-investigação)

**[BAIXA] `dev:clean` apaga `.next` em todo `npm run dev`**
- *O quê:* `desktop/package.json` — `dev` roda `dev:clean` que remove `.next` inteiro a cada start, descartando cache de build incremental.
- *Severidade:* **Baixa** (julgamento — custo de DX, provavelmente workaround de problema antigo).

### Dependências

**[MÉDIA] Peso morto pesado em `dependencies` do mobile**
- *O quê:* `mobile/package.json` lista em `dependencies` (não dev): `duckdb` (^1.4.4 — binário nativo de dezenas de MB), `express`, `jsdom`, `cors`, `sqlite3` E `sqlite` E `@capacitor-community/sqlite` (3 drivers SQLite), `context-mode`. O app Android empacota `www/` — nada disso vai pro APK, mas infla install/CI e confunde o que é runtime real.
- *Severidade:* **Média.** (fato + julgamento)

**[BAIXA] Stack atualizada — ponto forte mantido**
- Next 16.2 / React 19.2 / Tauri 2.9.5 / zod 4 / Capacitor 8 / Vitest 3. Pouca dívida de versão. (fato)

### DevEx e operações

**[ALTA] Zero CI/CD — ABERTO (inalterado)**
- *O quê:* `.github/` contém somente `copilot-instructions.md`; único hook é `.githooks/post-commit`.
- *Severidade:* **Alta.** (fato)

### Documentação

**[MÉDIA] Nenhum README no repositório**
- *O quê:* não existe `README.md` na raiz, em `desktop/` nem em `mobile/` (verificado). `CLAUDE.md` (17 KB) e `AGENTS.md` são os únicos onboarding — escritos para agentes de IA.
- *Por que importa:* um humano novo no projeto não tem ponto de entrada; "como buildar o APK" está enterrado em scripts.
- *Severidade:* **Média.** (fato)

**[BAIXA] CLAUDE.md com drift pontual**
- *O quê:* `CLAUDE.md` referencia a tabela `sync_event_queue` (2 ocorrências), mas a tabela real é `fila_eventos_sync` (`ensure-columns.ts:1461`); o "SyncEventDB" mobile e o pipeline descrito devem ser conferidos contra o mesmo rename.
- *Severidade:* **Baixa.** (fato)

### Pontos fortes (verificados hoje)
- **`sql_guard.rs` é defesa estrutural de verdade**: normalização de comentários/strings, single-statement, extração de tabela-alvo e colunas de SET, com 26 testes — exatamente a recomendação de ontem, implementada.
- **Clean Architecture com decomposição em progresso disciplinado**: padrão `_components`/`_hooks`/`_lib` estabelecido e replicado em 2 rotas; nenhum componente de UI do desktop acima de 742 linhas.
- **RBAC revalidado em Rust** com commands dedicados + audit log; `db_query` agora genuinamente read-only.
- **Sync criptografado** AES-256-GCM com PBKDF2 100k, chave nunca persistida, com prune de fila.
- **Disciplina de ADRs** (60+) e auditorias datadas com registro de remediação — raro.
- **Higiene de segredos pós-remediação**: tracking limpo, histórico reescrito, `.env.example` como template.

---

## 4. Estratégia de Melhoria

### Temas (4 explicam ~90% dos achados abertos)

**Tema 1 — Autenticação de produção.** Os 2 críticos restantes de código (seed `admin/admin`, senha só-dígitos) e 1 alto (fallback SHA-256) estão todos em ~40 linhas de `setup.rs` + `lib.rs`. *Estado-alvo:* boot fresco exige criação de primeiro admin com senha ≥8 mista; nenhum fallback de hash fraco. *Princípio:* conveniência de bootstrap não pode virar credencial pública — se o seed é necessário para dev, que seja atrás de flag de build (`#[cfg(debug_assertions)]` ou env explícita).

**Tema 2 — Gate automatizado antes de mais features.** Zero CI + baseline de 143 erros de lint + testes sem script executável = toda melhoria recente está desprotegida contra regressão. *Estado-alvo:* CI obrigatório com lint (baseline congelado via `--max-warnings`), `vitest run`, `cargo test`, e gitleaks. *Princípio:* o que não é verificado automaticamente, não é garantido.

**Tema 3 — O repo só deve conter o produto.** ~470 arquivos rastreados são peso morto (`mobile_standalone/`, `download/` com PII, duplicatas da raiz, bancos, scripts one-off). *Estado-alvo:* `git ls-files` na raiz retorna apenas workspaces + docs + configs. *Princípio:* main é o produto, não o histórico de experimentos.

**Tema 4 — Levar o padrão validado ao mobile.** Decomposição e lint estão maduros no desktop; o mobile concentra agora os maiores arquivos (data-service 2345 linhas) e os riscos de XSS (`innerHTML` ×65). *Estado-alvo:* serviços mobile < ~600 linhas; `innerHTML` com dados de usuário substituído por `textContent`/template seguro. *Princípio:* um padrão por monorepo, não um por workspace.

### Trade-offs explícitos (o que NÃO corrigir agora)
- **Não** reescrever o mobile em framework — JS vanilla + Capacitor funciona e tem testes Vitest.
- **Não** zerar os 143 erros de lint de uma vez — congelar o baseline no CI e reduzir por arquivo tocado ("boy scout rule"); zerar à força geraria um mega-diff de risco.
- **Não** decompor `ensure-columns.ts` (2138 linhas) — é DDL sequencial, legível como está; quebrá-lo cria risco de ordem de migração sem ganho.
- **Não** remover o crate `postgres` do desktop sem antes mapear `network_write_parquet` — está documentado como intencional em `desktop/docs/BACKEND_NAO_EXPOSTO.md`.
- **Não** perseguir unificação total de RBAC mobile/desktop — mobile é frontend-only por design (CLAUDE.md); apenas extrair a matriz para `ecoforms-core` quando tocar nesse código.

### Definição de "concluído" (sinais mensuráveis)
1. Boot em DB vazio **não** autentica `admin/admin`; senha exige ≥8 com letras e dígitos (teste Rust cobrindo).
2. CI verde obrigatório em PR: `eslint --max-warnings <baseline>`, `vitest run` (desktop+mobile), `cargo test`, gitleaks.
3. `git ls-files | grep -cE "^(mobile_standalone|download|js|src|src-tauri|app)/"` retorna **0**; nenhum `.sqlite`/`.db` rastreado.
4. Confirmação registrada (em `docs/`) da rotação da SERVICE_ROLE_KEY com data.
5. `mobile/package.json` com `test` real; nenhum arquivo de `mobile/www/js` (exceto vendor) > 1000 linhas nos 3 maiores atuais.

---

## 5. Plano de Tarefas

### Marco 0 — Rede de segurança
| # | Título | Arquivos | Critério de aceitação | Esforço | Risco | Dep. |
|---|---|---|---|---|---|---|
| 0.1 | **Pipeline CI** (lint baseline + vitest + cargo test + gitleaks) | `.github/workflows/ci.yml` (novo) | PR roda 4 jobs; falha bloqueia merge; lint usa baseline congelado | M | Baixo | — |
| 0.2 | Scripts `test` reais (desktop `"test": "vitest run"`; mobile idem; raiz delega) | `desktop/package.json`, `mobile/package.json:27`, `package.json` | `npm test -w desktop` e `-w mobile` rodam vitest e saem 0/1 corretamente | P | Baixo | — |
| 0.3 | Smoke e2e de autenticação (boot DB vazio → primeiro admin → login → ação protegida) | `desktop/e2e/` | fluxo coberto; roda no CI | M | Baixo | 0.1 |

### Marco 1 — Críticas (segurança/corretude)
| # | Título | Arquivos | Critério de aceitação | Esforço | Risco | Dep. |
|---|---|---|---|---|---|---|
| 1.1 | **Confirmar/executar rotação SERVICE_ROLE_KEY** + remover padrão `fallbackKey` | dashboard Supabase; `mobile/scripts/sync_remote_db_to_supabase.js:35-47` | rotação registrada em docs com data; script lê só de env e falha sem ela | P | Baixo | — |
| 1.2 | **Condicionar seed `admin/admin` a flag de dev** | `desktop/src-tauri/src/database.rs:59-60`, `commands/setup.rs:107-142` | build release não semeia; build dev semeia só com env `ECOFORMS_SEED_ADMIN=1`; atualizar ADR-051 | P | Médio | 0.3 |
| 1.3 | **Política de senha real** (≥8, letras+dígitos; remover exigência só-dígitos) | `setup.rs:38-42` + validação espelho no frontend de primeiro acesso | senha "1234" rejeitada; "abc12345" aceita; teste Rust | P | Baixo | 1.2 |
| 1.4 | Remover fallback SHA-256 de `verify_password` (com migração se houver hashes legados) | `desktop/src-tauri/src/lib.rs:16-28` | só `$2*` aceito; paridade com mobile; decisão documentada sobre usuários legados | P | Médio | 0.3 |

### Marco 2 — Alto impacto
| # | Título | Arquivos | Critério de aceitação | Esforço | Risco | Dep. |
|---|---|---|---|---|---|---|
| 2.1 | **Expurgar peso morto rastreado**: `mobile_standalone/`, `download/`, `js/`, `src/`, `src-tauri/`, `app/` (raiz), `*.sqlite`/`*.db`, scripts one-off | raiz; `.gitignore` | sinais §4.3; avaliar `git filter-repo` para `download/` (PII/LGPD no histórico) | M | Médio | 0.1 |
| 2.2 | Auditar e sanitizar `innerHTML` no mobile (65 pontos / 28 arquivos) | `mobile/www/js/**` | dados de usuário nunca em `innerHTML` cru; helper `setSafeHTML`/`textContent` | G | Médio | 0.2 |
| 2.3 | Reduzir baseline de lint: corrigir os erros `react-hooks/*` (bugs latentes) primeiro | 85 arquivos com erro (priorizar `react-hooks/set-state-in-effect`, `static-components`) | baseline ≤ 50 erros; nenhum erro `react-hooks` restante | M | Médio | 0.1 |
| 2.4 | Consolidar lockfiles (remover aninhados, `npm install` só na raiz) | locks em `desktop/`, `mobile/`, `packages/core/` | um único `package-lock.json`; CI instala da raiz | P | Médio | 0.1 |

### Marco 3 — Qualidade e polimento
| # | Título | Arquivos | Critério | Esforço | Risco | Dep. |
|---|---|---|---|---|---|---|
| 3.1 | README raiz + desktop + mobile (humanos: setup, build, arquitetura em 1 página cada) | `README.md` ×3 | dev novo builda desktop e APK só com o README | P | Baixo | — |
| 3.2 | Decompor `data-service.js` / `dashboard-service.js` / `device-setup.js` (mobile) | `mobile/www/js/` | nenhum < vendor > 1000 linhas; padrão de módulos do desktop adaptado | G | Médio | 0.2 |
| 3.3 | Modularizar `container.ts` (610 linhas) usando `container/modules/` já existente | `desktop/src/infrastructure/container.ts` | container < 250 linhas; módulos por domínio | M | Médio | 0.1 |
| 3.4 | Limpar deps do mobile (`duckdb`, `express`, `jsdom`, drivers SQLite duplicados → devDeps ou remoção) | `mobile/package.json` | `dependencies` contém só runtime real do app | P | Baixo | 0.2 |
| 3.5 | Atualizar CLAUDE.md (renomes PT-BR: `fila_eventos_sync` etc.) | `CLAUDE.md` | nomes de tabela conferem com `ensure-columns.ts` | P | Baixo | — |

### Vitórias rápidas (alto impacto / baixo esforço)
- **1.2 + 1.3** — fecham os 2 críticos de código em ~40 linhas de Rust (P cada).
- **0.2** — scripts `test` reais (P): os testes já existem, só não rodam.
- **1.1** — rotação da chave: ação de dashboard + 10 linhas de script (P).
- **3.1** — README raiz (P): maior ganho de onboarding por hora investida.

### Esboços de implementação — top 3

**Tarefa 1.2 — Seed condicional**
1. Em `database.rs:59`, envolver a chamada: só executar `seed_default_admin_conn` se `std::env::var("ECOFORMS_SEED_ADMIN").is_ok() && cfg!(debug_assertions)`.
2. No frontend, o fluxo de "tabela `usuarios` vazia → tela `create_first_admin`" já existe (`setup.rs:18`); garantir que a rota de primeiro acesso é o caminho default quando o seed não rodou.
3. Atualizar ADR-051 com a decisão revisada (seed = dev-only).
4. Teste: `cargo test` com DB em memória vazio → `usuarios` permanece vazia sem a env; e2e 0.3 cobre o fluxo de primeiro acesso.

**Tarefa 0.1 — Pipeline CI**
1. `.github/workflows/ci.yml` com 4 jobs em paralelo: `lint` (`npm ci && npx eslint . --max-warnings 168` no desktop, baseline atual congelado e decrescente), `test-js` (`vitest run` desktop + mobile), `test-rust` (`cargo test --manifest-path desktop/src-tauri/Cargo.toml` — cache via `Swatinem/rust-cache`), `secrets` (gitleaks-action).
2. Branch protection na master exigindo os 4 checks.
3. Nota Windows/Linux: o build Tauri completo não é necessário no CI de PR — `cargo test` compila o crate sem bundling; deixar `tauri build` para um workflow de release separado.

**Tarefa 2.1 — Expurgo de peso morto**
1. Lote 1 (sem reescrita de histórico): `git rm -r --cached mobile_standalone download js "src" "src-tauri" "app" BD_Flex_v2007.sqlite historical.db` + remoção física do que for seguro + entradas no `.gitignore`. Commit único revisável.
2. Lote 2 (decisão LGPD): se `download/` contém dados reais de cidadãos (placas confirmadas), avaliar `git filter-repo --path download --invert-paths` — coordenar force-push como em 2026-06-10.
3. Verificação: comando do sinal §4.3 retorna 0; `npm run build` desktop e `npm run build` mobile seguem verdes.

---

## 6. Perguntas em Aberto
1. **A SERVICE_ROLE_KEY foi rotacionada no dashboard após o expurgo de 2026-06-10?** Única pendência que mantém um Crítico condicional aberto. Se sim, registrar data em docs e rebaixar o achado.
2. **O seed `admin/admin` (ADR-051) é requisito de produto para alguma instalação headless real**, ou pode ser rebaixado a dev-only (tarefa 1.2)?
3. **Existem usuários com hash SHA-256 legado em alguma base de produção?** Determina se 1.4 é remoção simples ou precisa de migração com re-hash no próximo login.
4. **`mobile_standalone/` ainda é buildado/distribuído por alguém?** Se não, entra no lote 1 do expurgo (2.1).
5. **Os dados de `download/` (placas, formSubmissions) são reais?** Se sim, a remoção deve incluir o histórico (LGPD) e possivelmente notificação interna.
6. **Há remote/equipe além desta máquina?** Os force-push de filter-repo (2026-06-10 e eventual lote 2 de 2.1) precisam de coordenação; se o repo é single-dev, o custo é zero.

---

## 7. Delta vs. Auditoria 2026-06-10

| Achado de ontem | Estado hoje | Evidência |
|---|---|---|
| Service-role key versionada/histórico | ✅ Expurgada (rotação pendente de confirmação) | `git ls-files` limpo; `sync_remote_db_to_supabase.js:37` = `REDACTED_...` |
| Sanitização SQL por substring | ✅ Resolvido | `sql_guard.rs` (358 linhas, 14 testes) + `database.rs:98-102` |
| 3 arquivos-deus de UI | ✅ Resolvido | maiores hoje: 742 (`SchemaEditor.tsx`) no desktop |
| Working tree 647 pendências | ✅ Limpo | `git status` = 2 keystores untracked intencionais |
| Mojibake difundido | ✅ Não se reproduz (amostras UTF-8 válidas) | `auth-manager.js` lido como UTF-8 hoje |
| Seed `admin/admin` + senha fraca | ❌ Aberto (inalterado) | `setup.rs:38-42,107-142`; `database.rs:59` |
| Fallback SHA-256 | ❌ Aberto (inalterado) | `lib.rs:16-28` |
| Zero CI | ❌ Aberto (inalterado) | `.github/` só copilot-instructions.md |
| `mobile_standalone/` + `download/` | ❌ Abertos (e duplicatas da raiz **pioraram**: agora rastreadas) | `git ls-files` 452 + 14 + 31 |
| `innerHTML` ×65 | ❌ Aberto (inalterado) | contagem reconfirmada hoje |
