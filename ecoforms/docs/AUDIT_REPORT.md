# Auditoria Técnica — EcoForms

**Data:** 2026-06-11  
**Auditor:** Engenheiro Sênior / Principal  
**Repositório:** `ecoforms0`  
**Commit base:** `4c0411a` (docs: adicionar README humano)

---

## Resumo Executivo

### Nota Geral: **C+**

O EcoForms é um sistema desktop+mobile de gestão ambiental com arquitetura limpa em camadas (domain/application/infrastructure/interface) que demonstra maturidade organizacional considerável — ADRs numerados, ESLint com regras de boundary enforcement, SQL guard estrutural em Rust, testes unitários nas camadas críticas do backend. No entanto, apresenta deficiências sérias em segurança (segredos expostos, attack surface grande), cobertura de testes muito baixa no frontend, ausência total de CI/CD, e um monorepo com três targets (desktop/mobile/mobile_standalone) com程度的 configuração inconsistente.

### Top 3 Riscos

1. **Segredos em .env.local no repositório** — `SUPABASE_SERVICE_ROLE_KEY` com acesso admin total está em `.env.local`. Verificado: `git log --all -- .env.local` retorna vazio — nunca foi commitado. `.gitignore` já o bloqueia. Rotação ainda recomendável por precaução.
2. **Attack surface do backend Tauri** — `db_query`, `db_execute`, `db_execute_batch`, `supabase_admin_query`, `send_email`, `network_write_parquet` e `lan_write_file` são comandos IPC acessíveis via WebView sem rate limiting, sem audit logging consistente, com autorização baseada em `session.perfil` (string simples interceptável do lado JS).
3. **Zero CI/CD** — Não existe `.github/workflows`, Dockerfile, ou qualquer pipeline automatizado. Build, test e release são inteiramente manuais, sem gates de qualidade.

### Top 3 Oportunidades

1. **ESLint boundary enforcement já existe** — as regras em `desktop/eslint.config.mjs` que proíbem `domain/` de importar React/Tauri/Supabase são um ativo arquitetural raro. Exploit isto como fundação para testes de arquitetura automatizados.
2. **Rust sql_guard com testes** — `sql_guard.rs` + `database.rs` possuem 10+ testes unitários cobrindo SQL injection, multi-statement smuggling e RBAC. Expandir este padrão para o restante do backend.
3. **Monorepo com packages/core compartilhado** — a estratégia de shared core entre desktop e mobile já está esboçada (`packages/core/src/{sync,permissions,utils}`). Consolidar isto elimina duplicação massiva.

---

## Fase 1 — Mapa do Repositório

### Propósito

Sistema de gestão ambiental (EcoForms/EcoSuite) para empresas de coleta e destinação de resíduos. Funcionalidades: kanban de tarefas, agendamentos, logística com mapas, ouvidoria, gestão de clientes, módulos dinâmicos (form builder), sincronização offline/desktop↔cloud, RBAC com hierarquia de perfis, criptografia de dados sensíveis.

### Stack

| Camada | Tecnologia |
|--------|-----------|
| **Desktop Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS 4, Radix UI, TanStack Query |
| **Desktop Backend** | Tauri 2 (Rust), SQLite (rusqlite), Supabase (Postgres + Auth) |
| **Mobile Frontend** | Capacitor/Ionic, Tailwind CSS 3, Supabase JS |
| **Mobile Backend** | Express 5 ou Tauri (via `ecoforms-core` bridge) |
| **Core Compartilhado** | `packages/core` (TypeScript) — sync, permissions, utils |
| **Linguagens** | TypeScript/TSX (411 arquivos desktop), Rust (~6 arquivos), JavaScript (mobile) |
| **Build** | `next build` + `cargo tauri build` (desktop); Capacitor build (mobile) |
| **Testes** | Vitest (desktop + mobile), `#[test]` Rust nativo |

### Arquitetura (Desktop)

```
Tauri (Rust) ←── IPC ──→ Next.js (React 19) App Router
  │                           │
  ├─ database.rs              ├─ app/ (rotas Next.js)
  ├─ sql_guard.rs             ├─ components/ (UI)
  ├─ commands/                ├─ src/domain/ (6 entidades, casos de uso puros)
  │   ├─ actions.rs           ├─ src/application/ (ports, use cases)
  │   ├─ crypto.rs            ├─ src/infrastructure/
  │   ├─ email.rs             │   ├─ persistence/sqlite/ (29 Repos)
  │   ├─ key_rotation.rs      │   ├─ persistence/supabase/
  │   ├─ rbac.rs              │   ├─ sync/
  │   ├─ setup.rs             │   ├─ adapters/
  │   ├─ lan_storage.rs       │   └─ container/ (DI)
  │   ├─ sync_roteiros.rs     └─ src/interface/hooks/
  │   └─ audit.rs                 ├─ queries/
  ├─ session.rs                   ├─ mutations/
  ├─ network.rs                   └─ auth/
  └─ supabase_admin.rs
```

### Diretórios Principais

| Diretório | Descrição |
|-----------|-----------|
| `desktop/` | Aplicação desktop (Next.js + Tauri) |
| `desktop/app/` | Rotas App Router (~30 pages) |
| `desktop/components/` | Componentes UI (~40+ componentes, alguns 35KB+) |
| `desktop/src/domain/` | Entidades e casos de uso puros (69 arquivos) |
| `desktop/src/application/` | Ports, use cases, DI (100 arquivos) |
| `desktop/src/infrastructure/` | Adapters, persistence, sync (29 SQLite repos) |
| `desktop/src/interface/` | React hooks (queries/mutations/auth) |
| `desktop/src-tauri/` | Backend Rust (database, SQL guard, commands) |
| `mobile/` | Aplicação mobile (Capacitor + Express) |
| `mobile_standalone/` | Variante mobile standalone |
| `packages/core/` | Core TypeScript compartilhado (sync, permissions, utils) |
| `src-tauri/` | Raiz Tauri alternativa (legado?) |
| `.env.local` | **CONTÉM CREDENCIAIS REAIS** (Supabase service_role_key) |
| `docs/` | 38 ADRs documentados (numerados 014-055, com gaps) |

### Surpresas

- `.env.local` no repositório com `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY` em texto claro — embora `.gitignore` bloqueie este arquivo, o par já apareceu em contexto indexado.
- Três targets separados (desktop, mobile, mobile_standalone) com package.json inconsistentes e versões diferentes de dependências.
- Backend Rust minimal mas com SQL guard sofisticado (parser de SQL, validação estrutural) — qualidade inesperada para o tamanho do projeto.
- Nenhum `.github/workflows` — CI inexistente.
- `test.keystore` (~2.7KB) existe na working tree mas **nunca foi rastreado pelo git** — `git ls-files` e `git log --all` retornam vazio. `.gitignore` já o bloqueia, mas adicionar `*.keystore` explícito é recomendável.

---

## Fase 2 — Relatório de Auditoria

### Arquitetura e Design

#### A01 — Componentes deus (35KB+) — **Média**
- **O quê:** `SchemaEditor.tsx` (36.6KB), `EditTaskModal.tsx` (36.4KB), `FieldPropertiesPanel.tsx` (36.3KB), `BookingModal.tsx` (35.4KB) são arquivos monolíticos.
- **Onde:** `desktop/components/forms/`, `desktop/components/kanban/`
- **Por que importa:** Viola SRP, dificulta teste, revisão e manutenção. Arquivos >500 linhas correlacionam com defeitos.
- Refatorações recentes (commit `229e21e`, `d3c0659`) já decomposeram `ManifestacaoDetailPage` e `LogisticsMap` em hooks/componentes — sinal de conscientização e direção correta.

#### A02 — Três targets mobile com configuração duplicada — **Média**
- **O quê:** `mobile/package.json`, `mobile_standalone/package.json` e a raiz `package.json` têm scripts e dependências sobrepostos mas divergentes (Tailwind 3 vs 4, React 18 vs 19).
- **Onde:** `mobile/`, `mobile_standalone/`, raiz
- **Por que importa:** Duplicação de configuração gera drift silencioso. Dependências diferentes = comportamento diferente.

#### A03 — Container DI manual sem tipagem forte — **Média**
- **O quê:** `desktop/src/infrastructure/container.ts` (~33KB, 32.9KB) orquestra DI manualmente sem framework. Sem validação em compile-time das dependências.
- **Onde:** `desktop/src/infrastructure/container.ts`
- **Por que importa:** Refatorações em repositories ou ports não geram erros de compilação — falham em runtime. O tamanho real (~33KB) é significativamente maior que o esperado para um módulo de DI.

#### A04 — Rust backend mistura concerns de UI e segurança — **Média**
- **O quê:** `lib.rs` registra `verify_password`, `hash_password`, `toggle_devtools` como comandos IPC —(password hashing como comando IPC é acessível ao frontend WebView). `toggle_devtools` pode ser invocado em produção.
- **Onde:** `desktop/src-tauri/src/lib.rs:36-42`
- **Por que importa:** Password hashing no lado Rust é bom, mas como comando IPC exposto, qualquer XSS no WebView pode chamar `hash_password` diretamente.

### Segurança

#### S01 — **CREDENCIAIS SUPABASE EM ARQUIVO LOCAL** — **Crítica**
- **O quê:** `.env.local` contém `SUPABASE_SERVICE_ROLE_KEY` (JWT com role `service_role`) e `SUPABASE_ANON_KEY`. O service_role_key bypassa RLS (Row Level Security) no Postgres.
- **Onde:** `.env.local:3-4`
- **Por que importa:** Se este arquivo foi commitado em algum momento ou é compartilhado, qualquer pessoa com acesso ao repositório tem acesso admin total ao banco Supabase.
- **Ação:** Rotacionar ambas as chaves imediatamente. Confirmar que `.env.local` nunca esteve no histórico Git (`git log --all -- .env.local`). Adicionar `.env.local` ao `.gitignore` (já está, mas verificar histórico).

#### S02 — `supabase_admin_query` com autorização baseada em string de sessão JS — **Alta**
- **O quê:** `supabase_admin.rs` aceita `user_role` como string que vem do frontend (`AdminOperationRequest.user_role`). A autorização depende de `check_admin_permission(user_role)` que compara `user_role != "admin"`. O frontend controla o valor de `user_role`.
- **Onde:** `desktop/src-tauri/src/supabase_admin.rs:38-44`
- **Por que importa:** Um XSS ou modificação de localStorage permite elevar privilégios para admin. O role deveria vir da sessão server-side do Rust, não do parâmetro enviado pelo JS.

#### S03 — `send_email` envia credenciais SMTP em texto claro via IPC — **Alta**
- **O quê:** `email.rs` l Lê configuração SMTP (host, porta, user, password) do banco SQLite e faz o envio. A senha SMTP fica armazenada sem criptografia no campo `smtp_password` da tabela `tbl_email_config`.
- **Onde:** `desktop/src-tauri/src/commands/email.rs:15-17`, `email.rs:35-48`
- **Por que importa:** Senhas SMTP em texto claro no SQLite local. Qualquer acesso ao arquivo `.db` vaza credenciais de email.

#### S04 — `network_write_parquet` e `lan_write_file`: path traversal parcialmente mitigado — **Média**
- **O quê:** `network_write_parquet` sanitize o filename mas aceita qualquer `path` absoluto sem validação de diretório permitido. `lan_read_file`/`lan_write_file` aceitam caminhos arbitrários via IPC.
- **Onde:** `desktop/src-tauri/src/network.rs:96-112`, `desktop/src-tauri/src/commands/lan_storage.rs`
- **Por que importa:** XSS no WebView pode ler/escrever arquivos arbitrários no sistema de arquivos do usuário.

#### S05 — `toggle_devtools` disponível em builds de produção — **Média**
- **O quê:** O comando `toggle_devtools` é registrado sem `#[cfg(debug_assertions)]`.
- **Onde:** `desktop/src-tauri/src/lib.rs:36-42`
- **Por que importa:** Em produção, qualquer invocação via IPC pode abrir DevTools, expor estado interno, variáveis, e facilitar ataques.

#### S06 — `test.keystore` presente na working tree (não rastreado pelo git) — **Baixa**
- **O quê:** Um arquivo de keystore está na raiz do repositório, mas **nunca foi rastreado pelo git** (`git ls-files` e `git log --all` retornam vazio). `.gitignore` já o bloqueia.
- **Onde:** `test.keystore` (2.7KB)
- **Por que importa:** Keystores contêm certificados/chaves privadas de assinatura. Mesmo não rastreado, sua presença na working tree pode levar a commit acidental. Adicionar ao `.gitignore` explícito é recomendável, mas não há necessidade de `git rm`.

#### S07 — Derivação de chave customizada (SHA-256 × 100k) em vez de KDF padrão — **Média**
- **O quê:** `key_rotation.rs:19-26` usa `SHA-256(passphrase) × 100_000` iterations como KDF, em vez de Argon2id ou PBKDF2 com salt adequado.
- **Onde:** `desktop/src-tauri/src/commands/key_rotation.rs:19-26`
- **Por que importa:** SHA-256 iterado sem salt é vulnerável a ataques de dicionário com GPU. KDFs como Argon2id são projetados especificamente para resistir a este tipo de ataque.

### Qualidade de Código

#### Q01 — Cobertura de testes: ~18 test files para 411 arquivos TS/TSX — **Alta**
- **O quê:** Desktop tem ~11 `__tests__` directories + ~7 arquivos `.test.ts` soltos (total ~18). Mobile tem ~5 arquivos de teste. Para 411 arquivos fonte (desktop), isso é ~4.4% de cobertura estimada.
- **Onde:** Distribuído: `desktop/src/domain/*/`, `desktop/src/infrastructure/sync/`, `desktop/src/infrastructure/persistence/`, `desktop/src-tauri/src/` (Rust)
- **Por que importa:** Refatorações (como a decomposição de componentes grandes) não têm rede de segurança.

#### Q02 — Regras de boundary ESLint são `error` — **Ponto Forte**
- **O quê:** `desktop/eslint.config.mjs` define regras `no-restricted-imports` em nível `error` que impedem: `domain/` de importar React/Tauri/Supabase; `application/` de importar Tauri/Supabase/infrastructure; UI de importar Tauri/Supabase/`src/infrastructure/**` diretamente. Esta última via fachada `src/interface/hooks/queries/lookups.ts` — a regra foi **validada em escala**: 7 erros de lint corrigidos pelo commit `c2b7aba`, depois ~30 arquivos migrados nos 16 commits seguintes da sessão P3 sem reincidência. Padrão de 2 saídas: (a) lookups simples via funções em `lookups.ts` (~50 exports), (b) use-cases que recebem `db: SqlitePort` no construtor usam `QueryDef.sql` direto. Ver [[SQL_INLINE_AUDIT]] §Checklist.
- **Onde:** `desktop/eslint.config.mjs`
- **Por que importa:** Garante a integridade da arquitetura em camadas em tempo de compilação. A peça `UI ⊄ infrastructure` é a que tem histórico de violação mais recente — qualquer dev tocando em `components/**` ou `app/**` deve lembrar de passar por `src/interface/`.

#### Q03 — 18 TODOs/FIXMEs/HACKs no código — **Baixa**
- **O quê:** 18 ocorrências de `TODO`, `FIXME`, `HACK` ou `XXX` em `desktop/src`.
- **Por que importa:** Indica débito técnico reconhecido. Precisam ser triados.

### Testes

#### T01 — Sem testes de integração ou E2E — **Alta**
- **O quê:** Não há testes Playwright/Cypress configurados (apesar de `playwright` estar em `devDependencies` do mobile). Desktop usa apenas `vitest run` (unitários). Rust tem testes unitários em `database.rs` e `crypto.rs`.
- **Onde:** Ausência de `*.e2e.*`, `*.integration.*`, e qualquer config Playwright/Cypress funcional.
- **Por que importa:** Flows críticos (login, permissões, sincronização, CRUD) não têm validação automatizada end-to-end.

#### T02 — Cobertura Vitest configurada mas sem thresholds no desktop — **Média**
- **O quê:** `desktop/vitest.config.ts` não define thresholds de cobertura. O mobile define thresholds de 80% mas o coverage `include` aponta para `www/js/core/**/*.js` (path legado, possivelmente inexistente).
- **Onde:** `desktop/vitest.config.ts`, `mobile/vitest.config.js`
- **Por que importa:** Sem thresholds mensuráveis, a cobertura real pode regredir sem aviso.

### Performance

#### P01 — 29 repositories SQLite com queries manualmente construídas — **Média**
- **O quê:** Cada `SqliteXxxRepository.ts` constrói SQL manualmente. O maior (`SqliteManifestacaoRepository.ts`, 29.1KB) possivelmente contém queries complexas sem paginação consistente.
- **Onde:** `desktop/src/infrastructure/persistence/sqlite/`
- **Por que importa:** N+1 queries, falta de índices, e paginação inconsistente são riscos em conjuntos de dados grandes.

#### P02 — Mutex global no estado do banco SQLite — **Média**
- **O quê:** `DbState { conn: Mutex<Option<Connection>> }` no Rust. Todas as operações serializam no mesmo mutex.
- **Onde:** `desktop/src-tauri/src/database.rs:16`
- **Por que importa:** Em operações concorrentes, o mutex vira gargalo. Escritas longas bloqueiam leituras.

### Dependências

#### D01 — Versões divergentes entre desktop e mobile — **Média**
- **O quê:** Desktop usa `@supabase/supabase-js ^2.89.0`, mobile usa `^2.58.0`. Desktop usa Tailwind 4, mobile usa Tailwind 3. Desktop usa React 19, mobile parece usar React 18.
- **Onde:** `desktop/package.json`, `mobile/package.json`
- **Por que importa:** Versões divergentes de bibliotecas compartilhadas podem causar bugs diferentes em cada plataforma.

#### D02 — `context-mode` como dependência de produção no mobile — **Média**
- **O quê:** `"context-mode": "^1.0.109"` está em `dependencies` (não `devDependencies`) do `mobile/package.json`.
- **Onde:** `mobile/package.json`
- **Por que importa:** `context-mode` é uma ferramenta de IA/CLI para desenvolvedores, não uma dependência de runtime. Incluí-la no bundle de produção adiciona peso e ataque surface.

#### D03 — `express`, `cors`, `jsdom`, `sqlite3`, `duckdb` no mobile — **Média**
- **O quê:** Diversas dependências de infrastructure/servidor estão em `dependencies` do mobile, sugerindo que o bundle mobile pode incluir um servidor Express.
- **Onde:** `mobile/package.json:dependencies`
- **Por que importa:** Aumenta significativamente o tamanho do bundle mobile e introduz dependências que não são necessárias em um app Capacitor.

### DevEx e Operações

#### X01 — Zero CI/CD — **Crítica**
- **O quê:** Não existem arquivos em `.github/workflows/` nem Dockerfile. Os scripts em `package.json` são `vitest run` e `eslint`, mas sem automação.
- **Por que importa:** Builds e deploys são manuais. Não há gate impedindo merge de código quebrado ou inseguro.

#### X02 — Script `dev` destrói `.next` a cada start — **Baixa**
- **O quê:** `"dev": "npm run dev:clean && next dev -p 3001"` onde `dev:clean` faz `rmSync('.next', {recursive:true,force:true})`.
- **Onde:** `desktop/package.json:6`
- **Por que importa:** Adiciona 1-3 segundos a cada restart de dev. É um workaround para problemas de cache do Next.js que deveria ser resolvido na raiz.

#### X03 — Logs de produção com `println!` e `eprintln!` — **Média**
- **O quê:** `lib.rs:46-68` usa `println!` para logging em vez do plugin `tauri-plugin-log` já importado.
- **Onde:** `desktop/src-tauri/src/lib.rs:46,63`
- **Por que importa:** `println!` vai para stdout/stderr sem nível, estrutura, ou rotação. Em produção, é perdulário e inútil para debugging.

### Documentação

#### D04 — 38 ADRs sem índice central — **Baixa**
- **O quê:** Existem 38 ADRs em `docs/` (numerados 014-055, com gaps) com data e número, mas não há um `docs/INDEX.md` ou navegação consolidada.
- **Por que importa:** Dificulta a descoberta de decisões arquiteturais passadas.

#### D05 — README humano adicionado recentemente — **Ponto Forte**
- **O quê:** Commit `4c0411a` adiciona README em raiz/desktop/mobile.
- **Por que importa:** Onboarding facilitado, descrição de propósito clara.

### Pontos Fortes

1. **ESLint boundary enforcement** — Regras de arquitetura como código, em nível `error`.
2. **SQL Guard estrutural em Rust** — Parser de SQL que bloqueia multi-statement, valida kind, extrai tabelas — superior a checagens por substring. Com 10+ testes unitários.
3. **Arquitetura em camadas bem definida** — domain → application → infrastructure → interface, respeitada pelo ESLint.
4. **38 ADRs documentados** — Decisões arquiteturais registradas com data.
5. **Criptografia AES-256-GCM** — Payload encryption e key rotation com AES-256-GCM e nonce aleatório.
6. **RBAC com hierarquia de perfis** — Sistema de permissões granular implementado.
7. **Audit logging em Rust** — `log_audit` registra ações e gera eventos de sync automaticamente.

---

## Fase 3 — Estratégia de Melhoria

### Tema 1: Superfície de Ataque do Backend Tauri

**Estado-alvo:** Comandos IPC minimizados, autorização sempre derivada do Rust, sem credenciais em texto claro, sem path traversal.

**Princípio:** O backend Rust deve ser o único autoridade para autenticação/autorização. O frontend é um client não confiável.

**Trade-off explicitado:** Não faremos refactor completo do modelo de sessão (migrar de string para token assinado) neste ciclo — o custo é alto e o ganho imediato é coberto por validar `user_role` no Rust ao invés de aceitar do JS.

### Tema 2: Fundação de Qualidade (CI + Testes)

**Estado-alvo:** CI com lint, typecheck, testes unitários; coverage thresholds no desktop; pelo menos testes de integração para os 5 comandos Tauri mais sensíveis.

**Princípio:** Sem CI, toda qualidade é manual e esporádica. O primeiro passo não é 100% de cobertura — é ter um gate que funciona.

**Trade-off explicitado:** Não criaremos testes E2E (Playwright) neste ciclo. O custo de setup é proporcional para o ganho, e testes de integração nos commands Tauri cobrem o risk maior.

### Tema 3: Redução de Complexidade do Monorepo

**Estado-alvo:** Core compartilhado versionado e publicado; dependências alinhadas; `mobile_standalone` eliminado ou justificado; `context-mode` movido para devDeps.

**Princípio:** Três targets com configuração divergente é custo exponencial.

**Trade-off explicitado:** Não eliminaremos `mobile_standalone` neste ciclo se ele atende um caso de uso real — mas documentaremos a justificativa.

### Tema 4: Componentes Deus

**Estado-alvo:** Nenhum componente >500 linhas (exceto legado documentado com plan de refatoração).

**Princípio:** Componentes grandes são a principal fonte de bugs difíceis de isolar.

**Trade-off explicitado:** Não refaremos todos os componentes grandes. Priorizaremos os 4 >30KB identificados, decompondo em hooks + sub-componentes.

### Tema 5: Observabilidade e Operações

**Estado-alvo:** Logs estruturados via `tauri-plugin-log`; variáveis de ambiente documentadas em `.env.example`; keystores fora do git.

**Princípio:** Em produção, se você não pode observar, não pode resolver.

**Trade-off explicitado:** Não implementaremos APM/tracing distribuído neste ciclo. Logs estruturados resolvem 80% do problema com 20% do esforço.

### Sinais de "Concluído"

| Tema | Sinal Mensurável |
|------|-----------------|
| Superfície de ataque | Zero credenciais em texto claro; `toggle_devtools` sob `cfg(debug_assertions)`; `user_role` validado server-side |
| Fundação de qualidade | CI verde em PRs; `vitest run` com ≥20% coverage desktop; 5+ testes de integração Tauri |
| Redução de complexidade | `context-mode` em devDeps; versões de `supabase-js` unificadas; `mobile_standalone` justificado ou eliminado |
| Componentes deus | Zero componentes >30KB; máximo de 5 componentes >15KB |
| Observabilidade | Zero `println!` em código Rust; `.env.example` completo; `test.keystore` adicionado ao `.gitignore` |

---

## Fase 4 — Plano de Tarefas Detalhado

### Marco 0 — Rede de Segurança

| # | Título | Arquivos | Critério de Aceitação | Esforço | Risco | Depende |
|---|--------|----------|----------------------|---------|-------|---------|
| M0.1 | Rotacionar chaves Supabase | Supabase dashboard + `.env.local` | Chaves antigas revogadas; novo `.env.local` com novas chaves; confirmar `git log --all -- .env.local` vazio | P | Alto | — |
| M0.2 | Garantir que `test.keystore` não seja commitado | `test.keystore`, `.gitignore` | `.gitignore` contém `*.keystore`; `git ls-files test.keystore` vazio (nunca rastreado); confirmar que não há risco de commit acidental | P | Baixo | — |
| M0.3 | Configurar CI básico (GitHub Actions) | `.github/workflows/ci.yml` (novo) | Workflow roda `npm run lint`, `npm run test`, `cargo check` em PRs | M | Baixo | — |
| M0.4 | Mover `context-mode` para devDeps | `mobile/package.json` | `context-mode` em `devDependencies` | P | Baixo | — |

**Vitórias rápidas:** M0.1, M0.2, M0.4 (impacto alto, esforço pequeno)

### Marco 1 — Correções Críticas (Segurança e Corretude)

| # | Título | Arquivos | Critério de Aceitação | Esforço | Risco | Depende |
|---|--------|----------|----------------------|---------|-------|---------|
| M1.1 | Validar `user_role` server-side em `supabase_admin` | `desktop/src-tauri/src/supabase_admin.rs` | `AdminOperationRequest.user_role` removido; role derivado de `SessionState` no Rust | M | Médio | — |
| M1.2 | Proteger `toggle_devtools` com `#[cfg(debug_assertions)]` | `desktop/src-tauri/src/lib.rs` | Comando não existe em builds release | P | Baixo | — |
| M1.3 | Criptografar `smtp_password` no SQLite | `email.rs`, `setup.rs`, migration | Campo `smtp_password` armazenado como ciphertext AES-256-GCM; decrypt apenas no Rust | M | Médio | — |
| M1.4 | Restringir `network_write_parquet` e `lan_*` a diretórios permitidos | `network.rs`, `lan_storage.rs` | Validator de path que rejeita `..`, caminhos absolutos fora de dirs permitidos | M | Médio | — |
| M1.5 | Adicionar audit logging consistente aos commands sensíveis | `actions.rs`, `email.rs`, `setup.rs` | Todo comando Tauri que modifica dados chama `log_audit()` | G | Baixo | — |

**Esboço M1.1 (Validação server-side de role):**

```rust
// ANTES (supabase_admin.rs):
#[derive(Debug, Deserialize)]
pub struct AdminOperationRequest {
    table: String,
    operation: String,
    user_id: String,
    user_role: String,  // ← VEM DO FRONTEND (NÃO CONFIÁVEL)
    payload: serde_json::Value,
}

// DEPOIS:
#[derive(Debug, Deserialize)]
pub struct AdminOperationRequest {
    table: String,
    operation: String,
    payload: serde_json::Value,
}

#[tauri::command]
pub fn supabase_admin_query(
    request: AdminOperationRequest,
    state: State<'_, SupabaseAdminState>,
    session: State<'_, SessionState>,  // ← Derivar role daqui
) -> Result<AdminOperationResponse, String> {
    let perfil = session.perfil.lock().unwrap();
    let user_role = perfil.as_deref().unwrap_or("");
    check_admin_permission(user_role)?;
    // ...
}
```

**Esboço M1.2 (toggle_devtools seguro):**

```rust
// ANTES:
#[tauri::command]
fn toggle_devtools(window: tauri::WebviewWindow) { ... }

// DEPOIS:
#[cfg(debug_assertions)]
#[tauri::command]
fn toggle_devtools(window: tauri::WebviewWindow) { ... }

// E em invoke_handler, condicional:
#[cfg(debug_assertions)]
tauri::generate_handler![/* ..., toggle_devtools */]
```

### Marco 2 — Melhorias de Alto Impacto

| # | Título | Arquivos | Critério de Aceitação | Esforço | Risco | Depende |
|---|--------|----------|----------------------|---------|-------|---------|
| M2.1 | Adicionar coverage thresholds ao `desktop/vitest.config.ts` | `desktop/vitest.config.ts` | Thresholds: lines 20%, functions 20%, branches 15% | P | Baixo | — |
| M2.2 | Testes de integração para 5 commands Tauri críticos | `desktop/src-tauri/src/`, `desktop/src-tauri/tests/` (novo) | Testes para `db_query`, `db_execute`, `verify_password`, `create_first_admin`, `supabase_admin_query` com mock de DB | G | Médio | — |
| M2.3 | Decompor SchemaEditor.tsx (36.6KB) | `desktop/components/forms/SchemaEditor.tsx` | Arquivo resultante <500 linhas; hooks extraídos; testes passando | G | Médio | — |
| M2.4 | Decompor EditTaskModal.tsx (36.4KB) | `desktop/components/kanban/EditTaskModal.tsx` | Arquivo resultante <500 linhas; hooks extraídos; testes passando | G | Médio | — |
| M2.5 | Decompor FieldPropertiesPanel.tsx (36.3KB) e BookingModal.tsx (35.4KB) | `desktop/components/forms/`, `desktop/components/` | Cada um <500 linhas | XG | Médio | — |
| M2.6 | Alinhar `@supabase/supabase-js` entre desktop e mobile | `desktop/package.json`, `mobile/package.json` | Mesma versão major em ambos | P | Baixo | — |
| M2.7 | Substituir `println!`/`eprintln!` por `log::info!`/`log::error!` | `desktop/src-tauri/src/lib.rs` + outros | Zero `println!` em código Rust de produção; `tauri-plugin-log` level configurável | P | Baixo | — |

### Marco 3 — Qualidade e Polimento

| # | Título | Arquivos | Critério de Aceitação | Esforço | Risco | Depende |
|---|--------|----------|----------------------|---------|-------|---------|
| M3.1 | Criar `docs/INDEX.md` com índice dos ADRs | `docs/INDEX.md` (novo) | Índice navegável com links para todos os ADRs | P | Baixo | — |
| M3.2 | Avaliar e documentar ou eliminar `mobile_standalone/` | `mobile_standalone/`, documentação | DECISION.md justificando existência ou remoção completa | M | Baixo | — |
| M3.3 | Adicionar testes de integração de infra para repos SQLite críticos | `desktop/src/infrastructure/persistence/sqlite/__tests__/` | Testes para `SqliteUserRepository`, `SqliteKanbanRepository`, `SqliteManifestacaoRepository` | G | Médio | M0.3 |
| M3.4 | Substituir KDF customizado por Argon2id | `desktop/src-tauri/src/commands/key_rotation.rs` | `derive_recovery_key` usa Argon2id com salt; testes atualizados; migração backward-compatible | M | Alto | — |
| M3.5 | Remover script `dev:clean` ou resolver causa raiz do cache Next.js | `desktop/package.json` | `dev` roda sem `dev:clean`; `.next` não corrompe | M | Baixo | — |
| M3.6 | Adicionar `.env.example` completo e documentado | `.env.example` (atualizar) | Todas as variáveis documentadas com descrição e valor exemplo; advertência sobre service_role_key | P | Baixo | — |

---

## Perguntas em Aberto

1. **Histórico do `.env.local`** — O `.env.local` atual contém credenciais reais. Verificado: `git log --all -- .env.local` retorna vazio — **nunca foi commitado**. Rotação ainda recomendável por precaução, mas não há exposição no histórico.

2. **`src-tauri/` vs `desktop/src-tauri/`** — Existem dois diretórios Tauri: `src-tauri/` na raiz e `desktop/src-tauri/`. Qual é o ativo? O da raiz parece legado (contém `database.rs` de 14KB). Confirmar qual é o build target. Resposta: na raiz src-tauri/ legado

3. **`mobile_standalone/`** — Qual é o propósito desta variante? Parece uma cópia quase idêntica de `mobile/`. É um fork temporário ou permanente? Resposta: o fork é provisório, o standealone não será mais atualizado mas é necessário persistir até a versão final do mobile

4. **Express no mobile** — `mobile/package.json` inclui `express`, `cors`, `jsdom`, `duckdb`, `sqlite3` em dependencies. O mobile app roda um servidor HTTP? Qual é o modelo de deploy? Resposta: mobile app roda não roda um servidor HTTP

5. **Cobertura real vs configurada** — O `mobile/vitest.config.js` define thresholds de 80% mas aponta para `www/js/core/**/*.js`. Este path existe? Qual é a coverage real? Resposta: isso é desconhecido

6. **Sessão do lado Rust** — `SessionState` em `session.rs` armazena perfil como `Option<String>` via `Mutex<Option<String>>`. Há algum mecanismo de validação ou assinatura da sessão, ou confia-se inteiramente no frontend? Resposta: confia-se inteiramente no frontend, isso precisa mudar

7. **Deploy model** — Como o desktop app é distribuído? Auto-update? Assinatura code signing? O `tauri-plugin-updater` está planejado? Resposta: ainda não há planos para tauri-plugin-updater, é necessário avaliar a necessidade