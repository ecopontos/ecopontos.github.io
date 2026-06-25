# Análise de Simplificação da Arquitetura — EcoForms

> **Data**: 2026-06-11
> **Revisão**: 2026-06-11 — Corrigido com medições reais do codebase
> **Contexto**: Avaliação de viabilidade de migração Node.js + NeDB evoluiu para análise de oportunidades de simplificação arquitetural.
> **Conclusão original**: Node.js + NeDB é inviável (paradigma relacional → documentos quebraria todo o schema). Ver detalhes em `2026-06-11-VIABILIDADE-NODEJS-NEDB.md`.

---

## 1. Arquitetura Atual

### Stack por plataforma

| Camada | Desktop | Mobile |
|--------|---------|--------|
| Shell | Tauri 2.9 (Rust) | Capacitor 8 (Android) |
| Frontend | Next.js 16 + React 19 | Vanilla JS + Tailwind |
| Banco local | SQLite via `rusqlite` (Rust) | SQLite via `@capacitor-community/sqlite` |
| Cloud | Supabase (PostgreSQL) | Supabase |
| Core compartilhado | `ecoforms-core` (TypeScript, abstrai `SqlitePort`) | Mesmo core |
| Build | Cargo + Next.js + TypeScript | esbuild + Capacitor + Gradle |

### Dados quantitativos (medição real)

| Camada | Linhas (doc anterior) | Linhas (real) | Arquivos | Linguagem |
|--------|----------------------|---------------|----------|-----------|
| Rust backend (Tauri) | 2.988 | **2.610** | 17 | Rust |
| Desktop infra (sync+persist) | 10.213 | ~5.336* | 82 | TypeScript |
| Desktop app + domain + UI | 16.630 | **26.341** | 411 | TypeScript/TSX |
| Mobile JS (sem vendor) | 44.103 | **48.823** | 207 | JavaScript |
| Standalone JS | — | **46.955** | 191 | JavaScript |
| Core compartilhado | 1.608 | **1.403** | 22 | TypeScript |
| Sync module | 2.265 | **1.909** | 20 | TypeScript |
| Queries SQL parametrizadas | — | **1.227** | 17 | TypeScript |
| **Total (sem standalone)** | ~75.5K | **~80K** | ~736 | 3 linguagens |

*\*Desktop infra = persistência (repos + queries: ~2.434) + sync (1.909) + outros (~993).*

### Módulos Rust (desktop/src-tauri/src/) — medição real

| Arquivo | Linhas (doc anterior) | Linhas (real) | Responsabilidade |
|---------|----------------------|---------------|------------------|
| database.rs | 546 | ~546 | Conexão SQLite, db_query, db_execute, db_execute_batch, export |
| sql_guard.rs | 320 | ~320 | Sanitização estrutural de SQL, bloqueio de tabelas/colunas sensíveis |
| supabase_admin.rs | 275 | ~275 | Queries administrativas contra o Supabase |
| setup.rs | 210 | ~210 | Seed de admin padrão, first-login |
| sync_roteiros.rs | 206 | ~206 | Sincronização de roteiros externos |
| network.rs | 191 | ~191 | CEP lookup, network probe, parquet |
| key_rotation.rs | 183 | ~183 | Rotação e recuperação de salt de sync |
| lib.rs | 111 | ~111 | Entry point, registro de 28 commands, plugins |
| email.rs | 108 | ~108 | Envio SMTP via lettre |
| session.rs | 89 | ~89 | Estado de sessão em memória |
| crypto.rs | 78 | ~78 | AES-256-GCM encrypt/decrypt |
| audit.rs | 76 | ~76 | Trilha de auditoria |
| rbac.rs | 70 | ~70 | Controle de acesso por perfil/nível |
| actions.rs | 69 | ~69 | Ações de negócio (aceitar/encerrar demanda, agendar ecoponto) |
| lan_storage.rs | 58 | ~58 | Leitura/escrita de arquivos em rede LAN |
| **Total** | **~2.988** | **~2.610** | |

### Comandos Tauri registrados (28 comandos)

| Categoria | Comandos | Arquivo Rust |
|-----------|----------|-------------|
| Banco de dados | `db_connect`, `db_query`, `db_execute`, `db_execute_batch`, `db_last_insert_id`, `db_export_for_mobile` | `database.rs` |
| Sessão | `set_session`, `clear_session`, `get_session` | `session.rs` |
| Autenticação | `verify_password`, `hash_password` | `lib.rs` |
| Email | `send_email`, `test_email_connection` | `commands/email.rs` |
| Criptografia | `load_crypto_key`, `encrypt_payload`, `decrypt_payload` | `commands/crypto.rs` |
| Key rotation | `rotate_sync_salt`, `recover_sync_salt`, `list_salt_history` | `commands/key_rotation.rs` |
| RBAC | `commands::rbac::*` | `commands/rbac.rs` |
| Setup | `create_first_admin` | `commands/setup.rs` |
| Audit | `commands::audit::*` | `commands/audit.rs` |
| Actions | `demanda_aceitar`, `demanda_encerrar`, `ecoponto_agendar_remocao` | `commands/actions.rs` |
| Rede | `network_probe_path`, `network_list_parquet`, `network_write_parquet`, `fetch_cep` | `network.rs` |
| Supabase | `supabase_admin_query`, `supabase_admin_status` | `supabase_admin.rs` |
| LAN storage | `lan_read_file`, `lan_write_file`, `lan_list_dir` | `commands/lan_storage.rs` |
| Sync | `sync_roteiros_externos`, `sync_roteiros_status` | `commands/sync_roteiros.rs` |
| UI | `toggle_devtools` | `lib.rs` |

### Repositórios que acessam SQLite (29 repositórios + 17 queries)

**29 repositórios** em `desktop/src/infrastructure/persistence/sqlite/`:

SqliteAgendamentoRepository, SqliteAgendamentoNotificacaoRepository, SqliteClienteRepository, SqliteDataRegistryRepository, SqliteDecisionRegistryRepository, SqliteDemandaRepository, SqliteEcopontoRepository, SqliteEmailConfigRepository, SqliteExecucaoClienteRepository, SqliteHierarquiaPerfilRepository, SqliteKanbanRepository, SqliteLogisticsRepository, SqliteManifestacaoRepository, SqliteModuleRepository, SqliteModuleVisualViewRepository, SqliteNotificacaoSolicitanteRepository, SqliteProjectRepository, SqliteServiceSlotRepository, SqliteServiceTypeRepository, SqliteSetorRepository, SqliteSuiteRepository, SqliteTaskMetricsRepository, SqliteTaskRepository, SqliteTipoPrazoRepository, SqliteTipoResiduoRepository, SqliteUserRepository, SqliteUserWidgetInstanceRepository, SqliteViewRegistryRepository, SqliteDecisionRegistryRepository

**17 arquivos de queries** em `queries/`: `_types.ts`, `analysis.ts`, `classificacao.ts`, `data-registry.ts`, `forms.ts`, `inbox.ts`, `kanban.ts`, `logistica.ts`, `manifestacoes.ts`, `modules.ts`, `pacotes.ts`, `projetos.ts`, `service.ts`, `solicitacoes.ts`, `system.ts`, `tarefas.ts`, `usuarios.ts`

### Fluxo de uma query SQL (desktop)

```
React Component
  → UseCase (TypeScript)
    → Repository (TypeScript) — monta SQL + parâmetros
      → TauriSqliteAdapter.invoke("db_query", { sql, params })
        → IPC (serialização JSON — fronteira TS↔Rust)
          → Rust db_query() — sql_guard → rusqlite → SQLite
            → Resultado serializado JSON
              → IPC (fronteira Rust↔TS) → Repository → UseCase → Component
```

**3 fronteiras de linguagem** para cada SELECT/INSERT/UPDATE.

---

## 2. Duplicação Crítica: mobile/ vs mobile_standalone/

- **mobile**: 207 arquivos JS, 48.823 linhas
- **mobile_standalone**: 191 arquivos JS, 46.955 linhas
- Estimativa de sobreposição: ~86% dos arquivos idênticos
- `mobile_standalone` tem seu próprio `package.json`, `capacitor.config.json`, e `android/` — é um fork completo, não apenas cópia de JS
- `mobile_standalone` não está no workspace do `package.json` raiz — é um diretório órfão
- **Hipótese**: standalone foi um fork para testes offline, nunca foi mergeado de volta

---

## 3. Dependências Suspeitas (verificadas)

| Dependência | Local | Peso | Evidência de uso |
|-------------|-------|------|------------------|
| `duckdb` ^1.4.4 | mobile | ~30MB nativo | Nenhum import encontrado — **confirmado não usado** |
| `express` ^5.2.1 | mobile | ~2MB | Nenhum import encontrado — **confirmado não usado em runtime** |
| `cors` ^2.8.5 | mobile | ~0.5MB | Dependência de express, mesma situação |
| `jsdom` ^27.0.0 | mobile | ~10MB | Zero imports em source. Possivelmente usado em testes (vitest). **Mover para devDependencies, não remover** |
| `sqlite3` ^6.0.1 | desktop devDeps | ~5MB nativo | Pode estar duplicando função — **investigar se é usado** |

---

## 4. Oportunidades de Simplificação

### 4.1 TIER 1 — Baixo Esforço, Alto Impacto

#### A. Unificar mobile ↔ mobile_standalone

**Situação atual**: Dois diretórios com ~86% de sobreposição (47K linhas duplicadas). `mobile_standalone` é um fork funcional com configs, builds e Android separados.

**Ação**: Merge em `mobile/` com suporte a build variants via variável de ambiente ou config flag para as diferenças remanescentes.

**Ganho**:
- Elimina ~47K linhas duplicadas
- Remove 1 diretório raiz com configs e Android build
- Fim da ambiguidade sobre qual editar
- CI/CD mais simples (1 build mobile vs 2)

**Risco**: Baixo. As diferenças são mínimas e documentáveis. Necessário merge de `capacitor.config.json`, `package.json`, e configs do Android.

**Esforço**: 1-2 dias (incluindo merge de configs e builds Android, não apenas JS).

---

#### B. Remover dependências não utilizadas

**Ação**:
1. Remover `duckdb`, `express`, `cors` do `package.json` do mobile (confirmado: zero imports)
2. Mover `jsdom` de `dependencies` para `devDependencies` (usado em testes, não em runtime)
3. Investigar se `sqlite3` em desktop devDeps é usado ou pode ser removido
4. Rodar `npm install` para limpar lockfile

**Ganho**:
- ~50-90MB a menos em node_modules (duckdb=30MB, express=2MB, cors=0.5MB, jsdom=10MB, transitivas)
- Menos superfície de vulnerabilidades
- `npm install` mais rápido

**Risco**: Baixo. Validar com `npm run build && npm test` antes do commit.

**Esforço**: 2-4 horas (incluindo investigação de `sqlite3` e testes).

---

### 4.2 TIER 2 — Médio Esforço, Alto Impacto

#### C. Substituir backend Rust por Node.js (eliminar 3ª linguagem)

**Situação atual**: 2.610 linhas de Rust em 17 arquivos implementam operações de banco, crypto, email, rede e sync. O frontend TypeScript invoca tudo via Tauri IPC (3 fronteiras de linguagem por query).

**Proposta**: Manter Tauri como shell nativo (janela, FS, diálogos). Mover toda a lógica de backend para TypeScript, eliminando o Rust.

**Duas arquiteturas candidatas**:

##### C1. Node.js sidecar + better-sqlite3 (proposta original)

```
React Component
  → UseCase (TypeScript)
    → Repository (TypeScript) — monta SQL + parâmetros
      → HTTP localhost:PORT
        → Node.js sidecar
          → better-sqlite3 → SQLite (mesmo arquivo .sqlite)
```

**Vantagens**: better-sqlite3 é síncrono, performático, ACID completo, suporta transações.
**Desvantagens**:
- Requer node-gyp (compilação nativa C)
- Sidecar lifecycle management (spawn, kill, restart on crash) — Tauri não tem suporte nativo robusto
- Se o processo Node crashar, o app fica sem banco
- Porta local pode conflitar; CORS no localhost
- HTTP adiciona latência (~0.5ms por query) e necessidade de retry/timeout

##### C2. sql.js (WASM) no renderer — **Recomendada como primeira opção a avaliar**

```
React Component
  → UseCase (TypeScript)
    → Repository (TypeScript) — monta SQL + parâmetros
      → SqlJsAdapter implements SqlitePort (in-process)
        → sql.js (WASM) → SQLite in-memory
          → Persistência via Tauri FS plugin
```

**Vantagens**:
- Zero IPC, zero sidecar, zero HTTP, zero node-gyp
- Latência sub-ms (in-process)
- Distribuição pura — um bundle WASM, sem binários nativos
- `SqlitePort` já é a interface abstrata — precisamos apenas de `SqlJsAdapter`

**Desvantagens**:
- Carrega DB inteiro em memória (viável para <100MB, típico do EcoForms)
- Persistência requer write-back ao disco após writes (via Tauri FS plugin)
- Single-threaded no renderer — operações de escrita bloqueiam UI (mitigar com Web Worker)
- Startup mais lento (carregar WASM + DB em memória)

**Recomendação**: Fazer POC da C2 primeiro (1 semana). Se sql.js servir para o perfil de dados do EcoForms (DB típico <100MB), eliminar sidecar e HTTP. Se não, recorrer à C1.

**O que some em qualquer cenário**:
- 17 arquivos Rust (~2.610 linhas)
- Toolchain Rust (cargo, rustc) do setup de dev e CI/CD
- Compilação Rust no CI/CD (~3-5 min por build)

**O que permanece em Tauri**:
- Gerenciamento de janela nativa
- Acesso ao sistema de arquivos (plugins fs, dialog)
- Shell commands (plugin shell)
- Tray icon, notificações nativas

**O que é reimplementado em TypeScript** (~700 linhas):

| Recurso Rust | Substituição TS | Linhas est. | Observação |
|-------------|----------------|-------------|-----------|
| database.rs | better-sqlite3 ou sql.js | ~200 | SqlJsAdapter implementa SqlitePort |
| sql_guard.rs | Middleware/hook no repository | ~60 | **Não é desnecessário** — ver nota abaixo |
| crypto.rs | `crypto` nativo (aes-256-gcm) | ~40 | |
| email.rs | `nodemailer` | ~50 | |
| network.rs (CEP) | `fetch` nativo | ~20 | |
| session.rs | Em memória (Map) | ~30 | Não usar express-session em sidecar |
| supabase_admin.rs | `@supabase/supabase-js` (já existe) | ~80 | |
| setup.rs | Script de seed JS | ~40 | |
| key_rotation.rs | `crypto.randomBytes` | ~30 | |
| rbac.rs | Middleware TS | ~60 | |
| lan_storage.rs | `fs` nativo + HTTP | ~40 | |
| actions.rs | Move para UseCases TS existentes | ~30 | |
| audit.rs | Hook no repository | ~40 | |
| sync_roteiros.rs | Port para TS | ~80 | |
| **Total** | | **~770** | |

**Nota sobre sql_guard.rs**: O documento anterior classificava sql_guard.rs como "desnecessário com prepared statements". Isto é **incorreto**. O sql_guard faz proteções que prepared statements não cobrem:
- Bloqueia leitura de colunas de senha (`password_hash`, `hash_senha`) via query genérica
- Bloqueia DROP/ALTER em tabelas sensíveis
- Sanitização estrutural de SQL (independe de parametrização)

**Estas proteções precisam ser reimplementadas** como hook/middleware no repository TS, (~60 linhas).

**Ganho líquido**: ~1.840 linhas a menos (2.610 Rust - 770 TS novo), 1 linguagem eliminada, build Cargo removido.

**Risco**:
- sql.js: DB em memória, single-threaded, persistência assíncrona — mitigável com Web Worker e auto-save periódico
- better-sqlite3: node-gyp requer pré-binários por plataforma; sidecar lifecycle complexo
- Fase de testes de regressão é indispensável (28 comandos Rust reimplementados)

**Esforço**: 3-5 semanas (1 dev). Requer POC prévio de sql.js (1 semana incluída).

---

#### D. Simplificar arquitetura de sync (1.909 linhas → ~800)

**Situação atual**: 20 arquivos, 1.909 linhas de sync implementam event sourcing com:
- EventEnvelope (envelope com causation/correlation)
- HandlerRegistry (roteamento de tipos de evento)
- TransportService (transporte LAN/cloud)
- InboundService (recepção e aplicação)
- gap tracking + cursor management
- device logs + manifest
- crypto layer para envelopes
- SyncOutbox, NullSyncAdapter, LanDomainSyncService, SupabaseUserSyncService

**Proposta**: Se os requisitos offline permitirem, substituir por:

1. **Supabase Realtime** para sync online (broadcast de mudanças)
2. **Last-write-wins** com timestamps para conflitos (em vez de event sourcing)
3. **CRDT leve** (ex.: automerge ou yjs) apenas para os formulários que precisam de merge multi-dispositivo

**Ganho**: ~1.100 linhas a menos, menos bugs de sincronização, debug mais simples.

**Risco**:
- **Precisa validar requisitos offline** — o módulo de sync existe porque offline-first é requisito de negócio. Simplificar sem entender os requisitos é arriscado.
- Se 100% offline-first com reconciliação multi-dispositivo é obrigatório, o sync atual se justifica.
- Last-write-wins tem edge cases de perda de dados em edições concorrentes que o event sourcing resolve.

**Pré-requisito**: Estudo de requisitos offline antes de estimar esforço.

**Esforço**: 3-4 semanas (após estudo de requisitos, que leva 1-2 semanas).

---

### 4.3 TIER 3 — Alto Esforço, Impacto Variável

#### E. Unificar renderização mobile + desktop

**Situação atual**:
- Desktop: Next.js + React 19 + Radix UI + Tailwind (**26.341 linhas** em 411 arquivos, não 16.6K)
- Mobile: Vanilla JS + Tailwind + renderização manual de formulários (**48.823 linhas** em 207 arquivos, não 44.1K)
- Standalone: Vanilla JS + Tailwind + renderização manual (**46.955 linhas** em 191 arquivos)

**Opção A — Mobile com React + Capacitor**:
- Reutilizar componentes React do desktop no mobile
- Capacitor já suporta React (basta servir o bundle)
- Ganho: elimina lógica duplicada de renderização de formulários, validação, campos customizados
- Risco: portar **48.8K linhas** de JS vanilla para React é esforço massivo

**Opção B — Web Components compartilhados**:
- Extrair componentes de formulário como Web Components (Lit ou Stencil)
- Usar nos dois lados (React wrapper no desktop, nativo no mobile)
- Ganho: framework-agnostic, evolui independente
- Risco: Web Components têm overhead de interop com React

**Opção C — Componentizar o core do mobile primeiro**:
- Extrair campos de formulário, validação e lógica de negócio do mobile JS para `ecoforms-core`
- O desktop já consome o core; o mobile passaria a consumir também
- Ganho: sem reescrever UI, apenas compartilhar lógica
- Risco: menor, mas não resolve a duplicação de renderização

**Esforço**: 3-6 meses (Opção A), 2-4 meses (Opção B), 4-6 semanas (Opção C). Adiar para após Tier 1 e Tier 2.

---

#### F. sql.js no renderer (eliminar salto IPC)

**Proposta**: Em vez de Tauri IPC ou sidecar HTTP, usar `sql.js` (SQLite compilado para WASM) direto no processo do browser.

**Ganho**: Latência zero para queries (sem serialização, sem rede, sem IPC).

**Risco**:
- `sql.js` carrega o banco inteiro em memória (WebAssembly)
- DB típico do EcoForms é <100MB — viável para desktop (8-16GB RAM), problemático para mobile
- Persistência requer gravar o array de bytes de volta ao disco após cada write (via Tauri FS plugin)
- Single-threaded: operações de escrita bloqueiam a UI — mitigar com Web Worker
- Startup time: carregar WASM (1.5MB) + DB em memória adiciona 1-3s ao boot

**Nota**: Esta proposta foi promovida para **alternativa primária da Proposta C** (C2). Se a POC funcionar, a Proposta C inteira pode usar sql.js em vez de sidecar + better-sqlite3.

**Esforço**: 1-2 semanas para POC.

---

### 4.4 TIER 4 — Radical (Alto Risco)

#### G. Remover Supabase, usar apenas SQLite local + LAN sync

**Ganho**: Zero dependência cloud, offline total, sem custo de servidor.

**Risco**: Perde multi-dispositivo fora da LAN, backup cloud, acesso remoto, auth como serviço, storage de arquivos.

**Não recomendado** — o Supabase resolve problemas reais (auth, storage, realtime) que justificam sua presença.

---

## 5. Resumo Executivo

| # | Ação | Esforço (anterior) | Esforço (revisto) | Linhas salvas (anterior) | Linhas salvas (revisto) | Risco | Recomendação |
|---|------|--------------------|--------------------|--------------------------|--------------------------|-------|--------------|
| A | Unificar mobile/standalone | 2-4h | **1-2 dias** | ~5.000 | ~47.000 | Baixo | ✅ Fazer já |
| B | Remover deps não usadas | 1h | **2-4h** | ~50MB | ~50-90MB | Baixo | ✅ Fazer já |
| C | Rust → Node.js backend | 2-3 sem | **3-5 sem** | ~2.300 | **~1.840** | Baixo-Médio | ✅ Forte (POC sql.js primeiro) |
| D | Simplificar sync | 1-2 sem | **3-4 sem** (+ 1-2 sem estudo) | ~1.400 | ~1.100 | Médio | ⚠️ Estudar requisitos primeiro |
| E | Unificar renderização | 4-8 sem | **3-6 meses** (A) / 2-4 meses (B) | ~10K+ | ~10K+ | Alto | ⤵️ Adiar |
| F | sql.js POC | 1-2 sem | 1-2 sem | ~500 | — | Médio | 🔬 Fazer antes de C |
| G | Remover Supabase | 2-4 sem | — | — | — | Alto | ❌ Não |

### Plano sugerido (ordem de execução)

```
Semana 1:    A + B (quick wins) + iniciar POC sql.js (F)
Semana 2:    Concluir POC sql.js → decidir entre C1 (sidecar) e C2 (sql.js)
Semana 3-6:  C (migração Rust → TS, usando arquitetura definida na POC)
Semana 7-8:  Estudo de requisitos offline para D
Semana 9-11: D (simplificação de sync, se viável)
Semana 12+:  Decisão sobre E com base em resultado de C (se o desktop ficou mais
              simples, a componentização do core — opção C — pode ser mais viável)
```

### Resultado esperado após Tier 1 + Tier 2

| Métrica | Antes (real) | Depois (estimado) |
|---------|-------------|-------------------|
| Linguagens | 3 (Rust, TS, JS) | 2 (TS, JS) |
| Toolchains | 4 (cargo, next, esbuild, gradle) | 3 (next, esbuild, gradle) |
| Linhas totais (sem standalone) | ~80K | ~78.2K* |
| Linhas totais (com merge standalone) | ~127K | ~80K** |
| Tempo build limpo | ~8 min | ~4 min |
| Setup novo dev | Rust + Node + Android SDK | Node + Android SDK |

*\* Ganho de ~1.8K: 2.610 Rust eliminados - 770 TS reimplementados.*
*\*\* Após merge de mobile/standalone: elimina ~47K linhas duplicadas.*

---

## 6. Anexo — Decisões de Arquitetura para C (Rust → TS)

### C1 vs C2: Sidecar HTTP vs sql.js no renderer

| Critério | C1: Sidecar + better-sqlite3 | C2: sql.js (WASM) no renderer |
|----------|------------------------------|-------------------------------|
| Latência por query | ~0.5ms (localhost HTTP) | ~0.1ms (in-process) |
| Compilação nativa | Sim (node-gyp) | Não (WASM) |
| Setup de dev | Node.js + sidecar config | Sem sidecar |
| Uso de memória | Processo separado (~50MB) | DB inteiro em RAM (<100MB) |
| Persistência | Arquivo .sqlite direto ( Write-back assíncrono via FS plugin |
| Concorrência | Processo separado, não bloqueia UI | Single-threaded (bloqueia UI sem Web Worker) |
| Complexidade de lifecycle | Alto (spawn, kill, restart, port) | Baixo (carrega WASM no renderer) |
| Startup time | Normal + sidecar boot (+1-2s) | Normal + WASM load (+1-3s) |
| Distribuição | Binário Node.js por plataforma | Um bundle WASM, multi-plataforma |
| Mobile (futuro) | Incompatível (sem Node.js no Android) | Viável com Capacitor + WASM |

### Proteções do sql_guard.rs que precisam ser reimplementadas

O `sql_guard.rs` (320 linhas) não é "desnecessário com prepared statements". Ele implementa:

1. **Bloqueio de leitura de senhas** — `db_query` rejeita queries que contenham `PASSWORD_HASH` ou `HASH_SENHA`
2. **Bloqueio de operações DDL sensíveis** — `db_execute` rejeita `DROP TABLE`, `ALTER TABLE` em tabelas protegidas
3. **Sanitização estrutural** — Proteções independentes de parametrização

**Reimplementação**: Hook/middleware no repository TS (~60 linhas), filtrando queries por padrões antes de executar.

### Arquitetura mínima da Proposta C (com sql.js)

```
desktop/src/infrastructure/persistence/
├── SqlJsAdapter.ts          ← novo (implements SqlitePort)
├── SqlGuardMiddleware.ts    ← novo (~60 linhas, substitui sql_guard.rs)
├── sqlite/
│   ├── tauriSqliteAdapter.ts  ← legacy (remover após migração)
│   ├── SqliteTaskRepository.ts
│   ├── SqliteUserRepository.ts
│   └── ... (29 repos, 17 queries — ZERO mudanças)
```

`SqlJsAdapter` implementa a mesma interface `SqlitePort` que `TauriSqliteAdapter`. Os 29 repositórios e 17 queries **não mudam**.

### Arquitetura para comandos Rust restantes

| Módulo Rust | Implementação TS | Local |
|-------------|-----------------|-------|
| crypto.rs | `crypto` nativo do Node/Browser | `desktop/src/infrastructure/crypto/` |
| email.rs | `nodemailer` (se sidecar) ou API externa | `desktop/src/infrastructure/email/` |
| session.rs | Em memória (Map) | `desktop/src/infrastructure/auth/` |
| supabase_admin | `@supabase/supabase-js` (já existe) | `desktop/src/infrastructure/supabase/` |
| key_rotation | `crypto.randomBytes` | `desktop/src/infrastructure/crypto/` |
| rbac | Middleware TS | `desktop/src/infrastructure/auth/` |
| actions | Move para UseCases existentes | `desktop/src/application/` |
| audit | Hook no repository | `desktop/src/infrastructure/persistence/` |
| network (CEP) | `fetch` nativo | `desktop/src/infrastructure/network/` |
| network (parquet) | DuckDB WASM ou Apache Arrow | `desktop/src/infrastructure/network/` |
| lan_storage | Tauri FS plugin ou `fs` | `desktop/src/infrastructure/storage/` |
| setup | Script de seed JS | `desktop/src/infrastructure/persistence/` |
| sync_roteiros | Port para TS | `desktop/src/infrastructure/sync/` |