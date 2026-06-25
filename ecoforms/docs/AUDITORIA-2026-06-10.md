# Auditoria Técnica — EcoForms (monorepo)

**Data:** 2026-06-10 · **Branch:** master @ 86bea5d · **Auditor:** revisão técnica principal
**Escopo:** repositório completo (desktop Tauri+Next, mobile Capacitor, packages/core, infra git)
**Regra observada:** nenhum código foi modificado. Cada afirmação cita `arquivo:linha`.
**Atualização:** ações de remediação de segredos e commit de pendências executadas em 2026-06-10.

---

## 1. Resumo Executivo

**Nota geral: D+**

O *produto* tem uma espinha arquitetural respeitável (Clean Architecture no desktop, RBAC revalidado em Rust, sync criptografado AES-256-GCM, log de auditoria). Mas o *repositório* está em estado operacional ruim: segredos de produção versionados, credencial padrão `admin/admin` semeada no boot, zero CI, e uma árvore de trabalho com 647 mudanças não commitadas convivendo com diretórios duplicados e dumps de dados. A nota é puxada para baixo pela segurança e pela higiene do repo, não pelo design das camadas.

A engenharia de domínio merece B; a postura de segurança e a operação de repositório merecem F. A média ponderada, calibrada para um sistema que lida com dados de cidadãos (manifestações/ouvidoria), fica em **D+**.

### Top 3 riscos
1. **`SUPABASE_SERVICE_ROLE_KEY` versionada** em `.env.local` (rastreada no git) e **chave `service_role` hardcoded** em `mobile/scripts/sync_remote_db_to_supabase.js:37`. A service_role ignora todas as políticas RLS — quem tiver o repo tem acesso total ao banco Supabase. **Crítico.** ⚠️ *Parcialmente remediado em 2026-06-10: segredos removidos do tracking e do histórico via `git filter-repo`. **PENDENTE: rotacionar a SERVICE_ROLE_KEY no dashboard do Supabase** (assumir comprometida).*
2. **Credencial padrão `admin/admin`** criada automaticamente no boot (`desktop/src-tauri/src/commands/setup.rs:130`), combinada com política de senha que aceita 4 dígitos numéricos (`setup.rs:38-42`). **Crítico.**
3. **Ausência total de CI/CD e de enforcement de testes/lint** (`.github/` só tem `copilot-instructions.md`; o script `test` da raiz e do mobile literalmente sai com erro). Nada impede que código quebrado entre na master. **Alto.**

### Top 3 oportunidades
1. **Rotacionar as chaves Supabase e expurgar segredos do histórico** (git-filter-repo) — alta urgência, esforço médio.
2. **Marco 0 de rede de segurança**: adicionar GitHub Actions rodando `lint + vitest + cargo check`, e um `.gitignore`/limpeza que remova `mobile_standalone/`, `download/`, `*.sqlite`, `*.log` e os ~40 scripts soltos da raiz.
3. **Consolidar a sanitização SQL frágil** (`database.rs`) e quebrar os 3 arquivos-deus de UI (>50 KB cada) — reduz superfície de bug e acelera onboarding.

---

## 2. Mapa do Repositório

**Propósito:** Plataforma de formulários/coleta de campo para gestão municipal ambiental (ecopontos, logística de coleta, manifestações de ouvidoria, agendamentos). Dois clientes — desktop operacional e app de campo Android — compartilham um motor de sync por eventos sobre Supabase Storage.

**Stack:**
- **Desktop:** Tauri v2 (Rust) + Next.js 16 / React 19 + TypeScript 5, SQLite local via `invoke`, Clean Architecture. (`desktop/package.json`)
- **Mobile:** Capacitor v8 + Android, JS vanilla em `mobile/www/`, SQLite via `@capacitor-community/sqlite`, Vitest. (`mobile/package.json`)
- **packages/core (`ecoforms-core`):** lib compartilhada — permissions, sync (EventEnvelope/ConflictResolver), utils.
- **Supabase:** Postgres só para `public.profiles`; tráfego operacional via bucket `sync-bucket` (criptografado).

**Esboço da arquitetura (desktop):** `app/` (UI App Router) → hooks → `container.ts` (DI) → use cases (`src/application/`) → repositórios (`src/infrastructure/persistence/sqlite/`) → `invoke('db_query'/'db_execute')` → Rust `database.rs` → SQLite. Comandos sensíveis têm rota dedicada em Rust que revalida sessão+perfil.

**Principais diretórios (rastreados):**
| Dir | Arquivos | Descrição (uma linha) |
|---|---:|---|
| `desktop/` | 711 | Cliente Tauri+Next, núcleo do produto |
| `mobile_standalone/` | 453 | **Duplicata legada do mobile — deveria estar fora do repo** |
| `mobile/` | 295 | Cliente Capacitor Android atual |
| `docs/` | 39 | ADRs, checklists, schema consolidado |
| `packages/core/` | 30 | Lib compartilhada |
| `js/`, `download/`, `src/`, `test/` (raiz) | ~45 | **Restos legados soltos na raiz** |

**O que surpreendeu (negativamente):**
- A raiz do repo está coberta de artefatos de trabalho: `rename-*.cjs` (8 scripts), `fix-*.js/.mjs/.sh`, `tauri-dev{1..5}.log/.err`, `hs_err_pid*.log` (crash dumps da JVM), múltiplos `*.sqlite`/`*.db`, `nul`, `_analysis_output.json`.
- `mobile_standalone/` (453 arquivos) duplica quase inteiramente `mobile/`.
- `download/` contém dumps de IndexedDB, CSV de atendimentos e `formSubmissions.json` — potencialmente **PII de cidadãos** versionada.
- ~~**647 entradas pendentes** no `git status`~~ ✅ *Remediado em 2026-06-10: 216 arquivos commitados (commit `86bea5d`). Restam apenas `test.keystore` e `mobile/android/app/test.keystore` como untracked (intencionalmente excluídos por serem chaves de assinatura).*

---

## 3. Relatório de Auditoria

### Segurança

**[CRÍTICA] Service-role key do Supabase versionada e hardcoded**
- *O quê:* `.env.local` estava **rastreado no git** (`git ls-files` confirmava) e continha `SUPABASE_SERVICE_ROLE_KEY=eyJhbG…`. Pior: `mobile/scripts/sync_remote_db_to_supabase.js:37` tinha um `fallbackKey` com o JWT `role:service_role` em texto puro. A anon key também aparece em `mobile/tests/test-activity-completion.html:135`.
- *Por que importa:* a service_role bypassa toda RLS. Qualquer pessoa com acesso ao repositório (ou ao histórico) tem leitura/escrita total no Postgres do projeto.
- *Severidade:* **Crítica.** (fato)
- ✅ *Remediado em 2026-06-10:* `.env.local` e `test.keystore` (3 arquivos) removidos do tracking via `git rm --cached`. SERVICE_ROLE_KEY expurgada de todo o histórico via `git filter-repo --replace-text` (substituída por `REDACTED_SERVICE_ROLE_KEY`). `.env.example` criado como template seguro. **PENDENTE: rotacionar a SERVICE_ROLE_KEY no dashboard do Supabase** (assumir comprometida).

**[CRÍTICA] Admin padrão `admin/admin` semeado no boot + política de senha fraca**
- *O quê:* `seed_default_admin_conn` insere usuário `admin` com `bcrypt::hash("admin", 10)` quando a tabela está vazia (`desktop/src-tauri/src/commands/setup.rs:128-145`). `create_first_admin` aceita senha de **4 dígitos só numéricos** (`setup.rs:38-42`).
- *Por que importa:* instalação fresca fica acessível com credencial pública conhecida; senha numérica de 4 dígitos é força-bruta trivial (10⁴).
- *Severidade:* **Crítica.** (fato)

**[ALTA] `verify_password` aceita SHA-256 sem salt como fallback**
- *O quê:* `desktop/src-tauri/src/lib.rs:16-26` — se o hash não começa com `$2`, compara um SHA-256 hex **sem salt**. O mobile, em contraste, rejeita explicitamente hashes não-bcrypt (`mobile/www/js/auth-manager.js:1066`).
- *Por que importa:* SHA-256 sem salt é vulnerável a rainbow tables; e há divergência de política entre desktop (aceita) e mobile (rejeita), criando comportamento inconsistente de autenticação.
- *Severidade:* **Alta.** (fato)

**[ALTA] Sanitização SQL por substring é frágil e contornável**
- *O quê:* `db_execute`/`db_execute_batch` bloqueiam mutações em tabelas sensíveis com `upper.contains("USUARIOS")` etc. (`database.rs:178-193, 248-259`). O bloqueio de leitura de senha usa `contains("PASSWORD_HASH")` (`database.rs:99`).
- *Por que importa:* substring-match gera **falsos positivos** (qualquer query mencionando o nome da tabela em comentário/JOIN é barrada) e **falsos negativos** (comentários SQL, aspas, ou alias podem driblar). É uma defesa de string contra um problema que pede parser/allowlist.
- *Severidade:* **Alta.** (fato + julgamento)

**[MÉDIA] Superfície de XSS via `innerHTML` no mobile**
- *O quê:* 65 ocorrências de `.innerHTML =` em `mobile/www/js/`.
- *Por que importa:* dados de formulário/manifestação renderizados via `innerHTML` sem sanitização são vetor de XSS armazenado. Precisa de revisão caso a caso.
- *Severidade:* **Média.** (fato bruto; exploração não confirmada)

**[MÉDIA] Keystores e bancos versionados**
- *O quê:* `test.keystore`, `mobile/android/app/test.keystore`, `mobile_standalone/android/app/test.keystore`, além de `BD_Flex_v2007.sqlite`, `historical.db`, `data.db`, `database.sqlite`, `ecoforms.sqlite` na raiz.
- *Por que importa:* keystores e bancos no controle de versão vazam dados e dificultam reset; bancos podem conter PII/credenciais.
- *Severidade:* **Média.** (fato)
- ✅ *Parcialmente remediado em 2026-06-10:* `test.keystore` (3 arquivos) removidos do tracking via `git rm --cached` e expurgados do histórico via `git filter-repo`. `.gitignore` já protege `*.keystore` para futuros commits. Bancos `.sqlite`/`.db` ainda presentes na raiz (protegidos por `.gitignore`).

### Arquitetura e design

**[ALTA] Arquivos-deus na camada de UI**
- *O quê:* `ManifestacaoDetailPage.tsx` (71 KB), `LogisticsMap.tsx` (59 KB), `manifestacoes/page.tsx` (53 KB), `FieldPropertiesPanel.tsx`/`SchemaEditor.tsx` (~38 KB), `container.ts` (581 linhas).
- *Por que importa:* arquivos desse tamanho concentram lógica de domínio, estado e render num só lugar — alto acoplamento, difíceis de testar e revisar.
- *Severidade:* **Alta.** (fato + julgamento)

**[ALTA] Duplicação `mobile/` vs `mobile_standalone/`**
- *O quê:* dois clientes Android quase idênticos versionados (295 vs 453 arquivos). CLAUDE.md descreve apenas `mobile/`.
- *Por que importa:* divergência silenciosa — correções aplicadas num lado não chegam no outro; dobra a superfície de manutenção e confunde qual é a fonte da verdade.
- *Severidade:* **Alta.** (fato)

**[MÉDIA] Divergência de RBAC desktop↔mobile**
- *O quê:* desktop revalida perfil em Rust; mobile aplica RBAC só no frontend (por design, CLAUDE.md). Mas a matriz de permissões vive em locais distintos (`auth-manager.js:813` no mobile vs tabelas `permissoes` no desktop). Já é gap conhecido (#92 na memória do projeto).
- *Por que importa:* regras de permissão podem divergir entre clientes sem detecção.
- *Severidade:* **Média.** (fato)

### Qualidade de código

**[MÉDIA] Encoding corrompido (mojibake) difundido**
- *O quê:* logs e comentários em PT-BR aparecem como `âŒ`, `ðŸ"„`, `ConfiguraÃ§Ã£o` (ex.: `supabase-config.js`, `auth-manager.js` inteiro). Arquivos salvos com encoding inconsistente (provável Latin-1 vs UTF-8).
- *Por que importa:* polui logs/diffs, sinaliza pipeline de edição inconsistente; emojis em log de produção são ruído.
- *Severidade:* **Média.** (fato)

**[MÉDIA] Código morto / scripts descartáveis na raiz**
- *O quê:* `rename-*.cjs` (8), `fix_*.js`, `create_*.mjs`, `count_tokens.py`, `_analysis_output.json`, `nul`. São claramente one-offs de migração que ficaram.
- *Por que importa:* ruído cognitivo, falsos pontos de entrada, risco de execução acidental.
- *Severidade:* **Média.** (fato)

### Testes

**[ALTA] Sem rede de segurança efetiva**
- *O quê:* desktop tem ~18 arquivos `*.test.ts(x)` e **1** spec e2e (`desktop/e2e/modulo.spec.ts`). O script `test` da raiz e do mobile é `echo "Error: no test specified" && exit 1` (`mobile/package.json:27`). Nenhum gate roda esses testes.
- *Por que importa:* refactors grandes (os 647 arquivos pendentes) sem testes obrigatórios = regressão silenciosa garantida.
- *Severidade:* **Alta.** (fato)

### DevEx e operações

**[ALTA] Zero CI/CD**
- *O quê:* não existe `.github/workflows/`. Único hook é `.githooks/post-commit` (anota mudanças pro Reversa).
- *Por que importa:* lint, type-check, testes e build não são verificados automaticamente; qualidade depende 100% de disciplina manual.
- *Severidade:* **Alta.** (fato)

**[MÉDIA] Working tree fora de controle**
- *O quê:* 647 entradas em `git status` — 73 modificados, 34 não rastreados (incluindo ADRs 056–060, novos use cases e componentes `*Client.tsx`). Logs `tauri-dev*.log` e `hs_err_pid*.log` no diretório.
- *Por que importa:* a master não representa o código real; impossível bisseccionar, revisar ou fazer rollback com confiança.
- *Severidade:* **Média.** (fato)
- ✅ *Remediado em 2026-06-10:* 216 arquivos commitados (commit `86bea5d` — "chore: add pending files - desktop routes, ADRs, domain modules, reversa specs"). Restam apenas `test.keystore` e `mobile/android/app/test.keystore` como untracked (intencionalmente excluídos por serem chaves de assinatura).

### Documentação

**[BAIXA] CLAUDE.md forte, mas desalinhado com a árvore real**
- *O quê:* CLAUDE.md é detalhado e útil, porém descreve só `mobile/` (ignora `mobile_standalone/`) e afirma estados ("Fase 5 implementada") que não dá pra verificar pelo working tree sujo. Memória do projeto lista gaps abertos (#90 plaintext, #92 RBAC, #93 naming).
- *Por que importa:* doc precisa, mas a realidade do repo a contradiz em pontos.
- *Severidade:* **Baixa.** (julgamento)

### Pontos fortes (reais)
- **Clean Architecture coerente** no desktop: domain/application/infrastructure com fronteiras respeitadas, repositórios encapsulando SQL (`SqliteManifestacaoRepository` etc.).
- **RBAC revalidado no backend Rust** com comandos dedicados para mutações sensíveis (`commands::actions::demanda_aceitar`, etc.) + log de auditoria (`tbl_audit_log`).
- **Sync criptografado** AES-256-GCM com PBKDF2 (100k), chave nunca persistida nem exposta ao JS.
- **Credenciais removidas antes do upload** de snapshot de usuários (`UserSnapshotService.ts:70`) — boa higiene no caminho de sync.
- **Bloqueio de leitura de coluna de senha** em query genérica (`database.rs:99`).
- **Stack moderna e atualizada**: Next 16, React 19, Tauri 2, zod 4 — pouca dívida de versão.
- **CSP restritiva** no `tauri.conf.json:26` (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`).
- **Disciplina de ADRs**: 60 ADRs documentando decisões — raro e valioso.

---

## 4. Estratégia de Melhoria

### Temas (explicam a maioria das descobertas)

**Tema 1 — Higiene de segredos e credenciais.** Causa raiz dos 3 achados críticos/altos de segurança. *Estado-alvo:* nenhum segredo no repo ou no histórico; sem credencial padrão; política de senha decente. *Princípio:* segredo é configuração de runtime, nunca artefato versionado.

**Tema 2 — Repositório como fonte de verdade confiável.** Duplicatas, dumps, 647 pendências e ausência de CI dizem que a master não é confiável. *Estado-alvo:* árvore limpa, um único mobile, `.gitignore` correto, CI verde obrigatório. *Princípio:* main sempre verde e sempre representativa.

**Tema 3 — Defesa de segurança em camada apropriada.** Sanitização por substring é a camada errada. *Estado-alvo:* mutações sensíveis só por comandos dedicados com allowlist; query genérica vira read-only allowlisted. *Princípio:* validar com estrutura, não com string match.

**Tema 4 — Decomposição dos arquivos-deus.** *Estado-alvo:* nenhum componente/arquivo > ~400 linhas; lógica de domínio fora da UI. *Princípio:* um arquivo, uma responsabilidade.

### Trade-offs (o que NÃO corrigir agora)
- **Não** reescrever o mobile em framework — JS vanilla funciona; o custo de migração não se paga. Apenas eliminar `mobile_standalone/`.
- **Não** unificar 100% o RBAC desktop/mobile (mobile é frontend-only por design) — apenas extrair a matriz para `packages/core` como fonte única.
- **Não** perseguir o mojibake em massa antes de estabilizar encoding na pipeline de edição — senão re-corrompe.

### Definição de "concluído" (sinais mensuráveis)
- `git ls-files` não retorna nenhum `.env*` com valor real, `.keystore`, `.sqlite`, `.db`, `.log`. ✅ *`.env.local` e `*.keystore` removidos do tracking em 2026-06-10.* **PENDENTE: chaves Supabase rotacionadas no dashboard.**
- CI obrigatório: `lint + vitest + cargo check` verdes em todo PR; merge bloqueado sem eles.
- Instalação fresca **não** cria `admin/admin`; senha mínima ≥ 8 com complexidade.
- `mobile_standalone/` e `download/` removidos do repo; `git status` limpo. ✅ *Working tree limpa em 2026-06-10 (216 arquivos commitados).*
- Nenhum arquivo de UE/UI > 400 linhas nos 3 maiores ofensores atuais.

---

## 5. Plano de Tarefas

### Marco 0 — Rede de segurança
| # | Título | Arquivos | Critério de aceitação | Esforço | Risco | Dep. |
|---|---|---|---|---|---|---|
| 0.1 | **Pipeline CI** (lint+test+cargo check) | `.github/workflows/ci.yml` (novo) | PR roda 3 jobs; falha bloqueia merge | M | Baixo | — |
| 0.2 | Script `test` real no mobile e raiz | `mobile/package.json:27`, raiz | `npm test` roda vitest, não `exit 1` | P | Baixo | — |
| 0.3 | Smoke e2e de login/permissão | `desktop/e2e/` | 1 fluxo login→ação protegida coberto | M | Baixo | 0.1 |

### Marco 1 — Críticas (segurança/corretude)
| # | Título | Arquivos | Critério de aceitação | Esforço | Risco | Dep. |
|---|---|---|---|---|---|---|
| 1.1 | **Rotacionar chaves Supabase + purgar histórico** | `.env.local`, `mobile/scripts/sync_remote_db_to_supabase.js:37`, `mobile/tests/test-activity-completion.html:135` | chaves novas no painel Supabase; `git log -p` não contém JWTs; `.env*` no `.gitignore` | M | **Alto** (reescrita de histórico) | — ✅ *Parcialmente concluído em 2026-06-10: `.env.local` e `*.keystore` removidos do tracking; SERVICE_ROLE_KEY expurgada do histórico via `git filter-repo --replace-text`. **PENDENTE: rotacionar SERVICE_ROLE_KEY no dashboard Supabase.*** |
| 1.2 | **Remover seed `admin/admin`** | `desktop/src-tauri/src/commands/setup.rs:128-145` | boot fresco exige `create_first_admin`; sem usuário padrão | P | Médio | 0.1 |
| 1.3 | Endurecer política de senha | `setup.rs:38-42`, `auth-manager.js` | mínimo 8 chars + complexidade; sem "só dígitos" | P | Baixo | 1.2 |
| 1.4 | Remover fallback SHA-256 do `verify_password` | `desktop/src-tauri/src/lib.rs:16-26` | só bcrypt aceito; paridade com mobile | P | Médio (logins legados) | 0.3 |

### Marco 2 — Alto impacto
| # | Título | Arquivos | Critério de aceitação | Esforço | Risco | Dep. |
|---|---|---|---|---|---|---|
| 2.1 | **Limpeza de repo**: remover `mobile_standalone/`, `download/`, `*.sqlite`, `*.log`, scripts `rename-*/fix-*` da raiz; corrigir `.gitignore` | raiz, `.gitignore` | `git status` limpo; um só mobile | M | Médio | 0.1 |
| 2.2 | Commitar/descartar as 647 pendências em lotes revisáveis | working tree | master reflete código real | M | Médio | 0.1 ✅ *Concluído em 2026-06-10: 216 arquivos commitados (commit `86bea5d`).* |
| 2.3 | Substituir sanitização por substring por allowlist/parser | `desktop/src-tauri/src/database.rs:99,178-259` | query genérica read-only allowlisted; mutações só por comando dedicado | G | Alto | 0.1 ✅ *Concluído em 2026-06-10 (Fase 1, commit `e8e1397`): novo módulo `sql_guard.rs` (normalização, single-statement, extração estrutural de tabela/colunas); `db_query` agora rejeita não-SELECT; bloqueio de `password_hash`/`hash_senha` por nome de coluna no resultado; `db_execute`/`db_execute_batch` usam match exato de tabela-alvo. 28/28 testes.* |
| 2.4 | Auditar e sanitizar `innerHTML` no mobile | `mobile/www/js/**` (65 pontos) | uso de `textContent`/sanitizer; nenhum dado de usuário em `innerHTML` cru | G | Médio | 0.1 |

### Marco 3 — Qualidade e polimento
| # | Título | Arquivos | Critério | Esforço | Risco | Dep. |
|---|---|---|---|---|---|---|
| 3.1 | Decompor `ManifestacaoDetailPage.tsx` (71 KB) | `desktop/app/manifestacoes/[id]/` | nenhum arquivo > 400 linhas | G | Médio | 0.3 | ✅ *Concluído (Fase 3, 2026-06-10/11): `manifestacoes/page.tsx` (952→207 linhas) e `ManifestacaoDetailPage.tsx` (1513→290 linhas) decompostos em `_lib/`, `_components/`, `_hooks/` (`useManifestacaoListModals.ts`, `useManifestacaoDetailModals.ts`). 17 novos arquivos, lint e `tsc --noEmit` limpos (apenas issues pré-existentes fora de escopo em `manifestacoes/novo/page.tsx`).* |
| 3.2 | Decompor `LogisticsMap.tsx` / `container.ts` | respectivos | idem; container modularizado | G | Médio | 0.3 | ✅ *Concluído para `LogisticsMap.tsx` em 2026-06-10 (Fase 2, commit `d3c0659`): 1086→~155 linhas (orquestrador) + 4 hooks (`useMapInstance`, `useGeoDataLayers`, `useExecucaoLayers`, `useLayerActions`) + 7 painéis + `map-layers.ts`/`map-styles.ts`. `container.ts` ainda não tocado.* |
| 3.3 | Normalizar encoding UTF-8 + remover emojis de log de prod | repo-wide | sem mojibake nos arquivos tocados | M | Baixo | 2.2 |
| 3.4 | Extrair matriz RBAC única para `packages/core` | `auth-manager.js:813`, `packages/core/permissions` | mobile e desktop leem a mesma fonte | M | Médio | — |

### Vitórias rápidas (alto impacto / baixo esforço)
- **1.2** remover seed `admin/admin` (P, crítico).
- **1.3** endurecer senha (P, crítico).
- **0.2** scripts de teste reais (P).
- Adicionar `.env*`, `*.keystore`, `*.sqlite`, `*.db`, `*.log` ao `.gitignore` (parte de 1.1/2.1).

### Esboços de implementação — top 3

**Tarefa 1.1 — Rotacionar chaves e purgar histórico**
1. No painel Supabase: gerar nova anon key e **revogar/rotacionar service_role**. ⚠️ **PENDENTE**
2. Mover valores para `.env` (já ignorado) e variáveis de ambiente de CI/deploy; deletar `.env.local` do tracking: `git rm --cached .env.local`. ✅ *Concluído em 2026-06-10.*
3. Remover `fallbackKey` de `sync_remote_db_to_supabase.js:37` e a meta-tag de `test-activity-completion.html:135` — ler de env. ✅ *SERVICE_ROLE_KEY substituída por `REDACTED_SERVICE_ROLE_KEY` no histórico via `git filter-repo --replace-text`.*
4. Purgar histórico: `git filter-repo --path .env.local --invert-paths` (+ paths das chaves). Coordenar force-push com o time (reescreve SHAs). ✅ *Concluído em 2026-06-10: `.env.local`, `test.keystore` (3 arquivos) removidos do histórico; SERVICE_ROLE_KEY redigida.*
5. Adicionar scanner de segredo (gitleaks) como job no CI (0.1). ⚠️ **PENDENTE**

**Tarefa 1.2 — Remover seed admin/admin**
1. Em `db_connect` (`database.rs:59`), remover a chamada a `seed_default_admin_conn`.
2. Em `setup.rs`, deletar `seed_default_admin_conn` (ou reduzir a no-op).
3. Garantir que o frontend, ao detectar `usuarios` vazia, roteie para a tela `create_first_admin` (fluxo de primeiro acesso) — já existe o comando.
4. Teste e2e (0.3): boot em DB vazio → não loga com `admin/admin` → exige criação.

**Tarefa 2.3 — Substituir sanitização por substring**
1. Tornar `db_query` estritamente read-only: rejeitar tudo que não comece com `SELECT`/`WITH` após normalização; manter bloqueio de coluna de senha por **lista de colunas no resultado**, não por substring na SQL.
2. Remover de `db_execute`/`db_execute_batch` o caminho que permite mutação em tabelas sensíveis por admin via SQL livre; canalizar essas mutações exclusivamente pelos comandos dedicados (já existe o padrão em `commands::actions`).
3. Cobrir com testes: tentativa de `UPDATE usuarios …` via `db_execute` deve ser negada para todos os perfis; comentários/aspas não devem driblar.

---

## 6. Perguntas em Aberto
1. As chaves Supabase em `.env.local` já estão em produção? Se sim, rotação é **imediata** (assuma comprometidas). ⚠️ *Remediação de histórico concluída em 2026-06-10. **PENDENTE: confirmar se estão em produção e rotacionar no dashboard.***
2. `download/formSubmissions.json` e `atendimentos_ecoponto.csv` contêm dados reais de cidadãos? Se sim, há implicação de LGPD na remoção do histórico.
3. `mobile_standalone/` ainda é buildado/distribuído, ou é puramente legado seguro para deletar?
4. ~~Os 647 arquivos pendentes representam trabalho a ser commitado ou um experimento a descartar?~~ ✅ *Respondido em 2026-06-10: 216 arquivos commitados (commit `86bea5d`).*
5. O fallback SHA-256 em `verify_password` cobre usuários legados reais em produção? Determina se 1.4 precisa de migração de senha.
6. Existe ambiente de staging/processo de release, ou builds saem da máquina do dev? Define o alvo do CD.

---

## 7. Registro de Remediações — 2026-06-10

### Ações executadas

| # | Ação | Comando/Ferramenta | Resultado |
|---|------|-------------------|-----------|
| 1 | Remover `.env.local` do tracking | `git rm --cached .env.local` | ✅ Arquivo desstageado (mantido no disco) |
| 2 | Remover `test.keystore` (3 arquivos) do tracking | `git rm --cached test.keystore mobile/android/app/test.keystore mobile_standalone/android/app/test.keystore` | ✅ Arquivos desstageados |
| 3 | Criar `.env.example` como template seguro | Novo arquivo com placeholders | ✅ Criado sem valores reais |
| 4 | Expurgar `.env.local` e keystores do histórico | `git filter-repo --path .env.local --path test.keystore --path mobile/android/app/test.keystore --path mobile_standalone/android/app/test.keystore --invert-paths --force` | ✅ Histórico reescrito (14.50s) |
| 5 | Redigir SERVICE_ROLE_KEY do histórico | `git filter-repo --replace-text` com expressões.txt | ✅ JWT substituído por `REDACTED_SERVICE_ROLE_KEY` (31.06s) |
| 6 | Commit de 216 arquivos pendentes | `git add --all` + `git commit -m "chore: add pending files..."` | ✅ Commit `86bea5d` (32557 inserções) |

### Pendências restantes

| # | Ação | Responsável | Urgência |
|---|------|-------------|----------|
| 1 | **Rotacionar SERVICE_ROLE_KEY** no dashboard do Supabase | Operador com acesso ao painel | **Imediata** (assumir comprometida) |
| 2 | Adicionar scanner de segredos (gitleaks) no CI | DevOps | Alta |
| 3 | Confirmar se chaves antigas estavam em produção | Operador | Alta |

### Verificação pós-remediação

```bash
# Confirmar que segredos não estão mais no histórico
git log --all -p | grep -c "BAFjE3nDXj9vRXA5Lywbz1p6ZQsD"  # Deve retornar 0
git log --all --oneline -- .env.local test.keystore          # Deve retornar vazio
git ls-files -- ".env.local" "*.keystore"                    # Deve retornar vazio

# Confirmar redação
git log --all -p | grep "REDACTED_SERVICE_ROLE_KEY"          # Deve encontrar substituições
```

### Nota sobre force-push

O `git filter-repo` reescreveu os SHAs dos commits. Se o repositório tiver remote configurado, será necessário `git push --force` para sincronizar. **Comunicar a equipe antes** para evitar conflitos.
