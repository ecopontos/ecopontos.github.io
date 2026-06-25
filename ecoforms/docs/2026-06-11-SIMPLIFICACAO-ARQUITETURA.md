# Simplificação da Arquitetura — EcoForms

> **Data**: 2026-06-11
> **Status**: **documento canônico**. Consolida e substitui três rascunhos do mesmo entregável:
> - `2026-06-11-VIABILIDADE-NODEJS-NEDB.md` (pergunta de origem → vira o **Anexo B**)
> - `2026-06-11-ANALISE-SIMPLIFICACAO-ARQUITETURA.md` (plano em tiers → corpo deste doc)
> - `2026-06-11-AVALIACAO-SIMPLIFICACAO-ARQUITETURA.md` (revisão crítica → **incorporada no texto**, não mais paralela)
>
> Os três originais foram arquivados em `docs/Concluidos/`.
> **Todas as medições foram verificadas contra `HEAD 4c0411a` (2026-06-11)** via `git ls-files` + `wc -l`. Onde duas medições coexistiam (`2.610` vs `2.988` para Rust), prevalece a contagem bruta verificada.

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

### Dados quantitativos (medição verificada em `4c0411a`)

| Camada | Linhas | Arquivos | Linguagem | Método |
|--------|-------:|---------:|-----------|--------|
| Rust backend (Tauri) | **3.012** | 17 | Rust | `wc -l` bruto sobre `src-tauri/src/**/*.rs` |
| Desktop app + domain + UI | ~26.341 | 411 | TS/TSX | medição anterior, não re-verificada |
| Mobile JS (sem vendor) | ~48.823 | 207 | JS | medição anterior, não re-verificada |
| `mobile_standalone` JS | ~46.955 | 191 (452 rastreados) | JS | fork completo, ver §2 |
| Core compartilhado | ~1.403 | 22 | TS | |
| Sync module | ~1.909 | 20 | TS | |
| Queries SQL parametrizadas | ~1.227 | **17** | TS | |
| **Total (sem standalone)** | **~80K** | ~736 | 3 linguagens | |

> **Nota de metodologia (correção da revisão anterior):** uma revisão intermediária afirmou que o Rust tinha "2.610 linhas" e que os "2.988" originais estavam superestimados. A contagem bruta verificada (`wc -l`, 17 arquivos) é **3.012** — ou seja, o número original estava essencialmente correto (delta +0,8%). O valor `~2.610` corresponde a linhas de código sem blanks/comentários (estilo `cloc`) e cobre apenas os 15 módulos principais da tabela abaixo. Ambas as contagens são válidas; medem coisas diferentes.

### Módulos Rust (`desktop/src-tauri/src/`)

| Arquivo | Linhas (~) | Responsabilidade |
|---------|-----------:|------------------|
| database.rs | 546 | Conexão SQLite, db_query, db_execute, db_execute_batch, export |
| sql_guard.rs | 320 | Sanitização estrutural de SQL, bloqueio de tabelas/colunas sensíveis |
| supabase_admin.rs | 275 | Queries administrativas contra o Supabase |
| setup.rs | 210 | Seed de admin (dev-only), first-login, política de senha |
| sync_roteiros.rs | 206 | Sincronização de roteiros externos |
| network.rs | 191 | CEP lookup, network probe, parquet |
| key_rotation.rs | 183 | Rotação e recuperação de salt de sync |
| lib.rs | 111 | Entry point, registro de 28 commands, plugins |
| email.rs | 108 | Envio SMTP via lettre |
| session.rs | 89 | Estado de sessão em memória |
| crypto.rs | 78 | AES-256-GCM encrypt/decrypt |
| audit.rs | 76 | Trilha de auditoria |
| rbac.rs | 70 | Controle de acesso por perfil/nível |
| actions.rs | 69 | Ações de negócio (aceitar/encerrar demanda, agendar ecoponto) |
| lan_storage.rs | 58 | Leitura/escrita de arquivos em rede LAN |
| **Subtotal (15 módulos)** | **~2.590** | |

> A diferença entre o subtotal (~2.590) e o total bruto verificado (**3.012**) são os 2 arquivos não listados (declarações de módulo / `mod.rs`) mais linhas em branco e comentários.

### Comandos Tauri registrados (28 comandos) — fonte única

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

### Repositórios e queries SQLite — fonte única

**28 repositórios** em `desktop/src/infrastructure/persistence/sqlite/` (verificado: `git ls-files Sqlite*.ts` = 28):

SqliteAgendamentoRepository, SqliteAgendamentoNotificacaoRepository, SqliteClienteRepository, SqliteDataRegistryRepository, SqliteDecisionRegistryRepository, SqliteDemandaRepository, SqliteEcopontoRepository, SqliteEmailConfigRepository, SqliteExecucaoClienteRepository, SqliteHierarquiaPerfilRepository, SqliteKanbanRepository, SqliteLogisticsRepository, SqliteManifestacaoRepository, SqliteModuleRepository, SqliteModuleVisualViewRepository, SqliteNotificacaoSolicitanteRepository, SqliteProjectRepository, SqliteServiceSlotRepository, SqliteServiceTypeRepository, SqliteSetorRepository, SqliteSuiteRepository, SqliteTaskMetricsRepository, SqliteTaskRepository, SqliteTipoPrazoRepository, SqliteTipoResiduoRepository, SqliteUserRepository, SqliteUserWidgetInstanceRepository, SqliteViewRegistryRepository

> **Correção:** revisões anteriores citavam "29 repositórios" — a lista duplicava `SqliteDecisionRegistryRepository`. O número real é **28**.

**17 arquivos de queries** em `queries/`: `_types.ts`, `analysis.ts`, `classificacao.ts`, `data-registry.ts`, `forms.ts`, `inbox.ts`, `kanban.ts`, `logistica.ts`, `manifestacoes.ts`, `modules.ts`, `pacotes.ts`, `projetos.ts`, `service.ts`, `solicitacoes.ts`, `system.ts`, `tarefas.ts`, `usuarios.ts`.

### Contrato de persistência — `SqlitePort`

```typescript
// packages/core/src/ports/SqlitePort.ts (verificado, bit-idêntico)
export interface SqlitePort {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    execute(sql: string, params?: unknown[]): Promise<void>;
    transaction<T>(callback: () => Promise<T>): Promise<T>;
}
```

Implementações: **Desktop** `TauriSqliteAdapter` → `invoke('db_query'/'db_execute')` → Rust → rusqlite. **Mobile** adapter Capacitor direto. Esta interface é o pivô de toda proposta de troca de motor — qualquer adapter novo (better-sqlite3, sql.js) implementa o mesmo contrato, e os 28 repositórios + 17 queries **não mudam**.

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

## 2. Duplicação crítica: `mobile/` vs `mobile_standalone/`

- **mobile**: 207 arquivos JS (~48.823 linhas); 295 arquivos rastreados no total.
- **mobile_standalone**: 191 arquivos JS (~46.955 linhas); **452 arquivos rastreados** (verificado em `4c0411a`).
- Sobreposição estimada: ~86% dos arquivos.
- `mobile_standalone` tem `package.json`, `capacitor.config.json` e `android/` próprios — é um **fork completo e funcional**, não só cópia de JS. Não está no workspace do `package.json` raiz; é diretório órfão.
- **Hipótese**: fork para testes offline, nunca mergeado de volta.

> Este item também aparece na `AUDITORIA-2026-06-11.md` (achado "[ALTA] Duplicação mobile/standalone"). Esta seção é a fonte de análise; a auditoria apenas o registra como risco de repositório.

---

## 3. Dependências não utilizadas (verificadas)

| Dependência | Local | Peso | Evidência |
|-------------|-------|------|-----------|
| `duckdb` ^1.4.4 | mobile (deps) | ~30MB nativo | **Zero imports** em `mobile/www` (verificado) |
| `express` ^5.2.1 | mobile (deps) | ~2MB | **Zero imports** em runtime (verificado) |
| `cors` ^2.8.5 | mobile (deps) | ~0.5MB | Dependência de express, mesma situação |
| `jsdom` ^27.0.0 | mobile (deps) | ~10MB | Zero imports em source; provavelmente test-only → **mover para devDependencies, não remover** |
| `sqlite` ^5.1.1 + `sqlite3` ^6.0.1 | mobile (deps) | ~5MB | Coexistem com `@capacitor-community/sqlite` (3 drivers SQLite) — **investigar/remover redundância** |

---

## 4. Oportunidades de Simplificação

> Esforços e ganhos abaixo já refletem a revisão crítica (antes documento separado): números reais, riscos antes omitidos e `sql.js` promovido a alternativa primária da Proposta C.

### 4.1 TIER 1 — Baixo esforço, alto impacto

#### A. Unificar `mobile` ↔ `mobile_standalone`
**Ação**: merge em `mobile/` com build variants (env/flag) para as diferenças remanescentes, incluindo merge de `capacitor.config.json`, `package.json` e configs Android.
**Ganho**: elimina ~47K linhas duplicadas, 1 diretório raiz, ambiguidade sobre qual editar, 1 build mobile a menos.
**Risco**: Baixo. **Esforço**: **1-2 dias** (inclui merge de builds Android, não só JS).

#### B. Remover dependências não usadas
**Ação**: remover `duckdb`, `express`, `cors`; mover `jsdom` para devDeps; investigar redundância `sqlite`/`sqlite3`; `npm install` para limpar lockfile.
**Ganho**: ~50-90MB a menos em node_modules; menos superfície de vulnerabilidade.
**Risco**: Baixo (validar com `npm run build && npm test`). **Esforço**: **2-4h**.

### 4.2 TIER 2 — Médio esforço, alto impacto

#### C. Substituir backend Rust por TypeScript (eliminar a 3ª linguagem)
**Proposta**: manter Tauri como shell nativo (janela, FS, diálogos); mover toda a lógica de backend para TS, eliminando os 17 arquivos Rust (3.012 linhas).

Duas arquiteturas candidatas:

**C2. `sql.js` (WASM) no renderer — avaliar primeiro**
```
Repository (TS) → SqlJsAdapter implements SqlitePort (in-process) → sql.js (WASM) → SQLite in-memory → persistência via Tauri FS plugin
```
Vantagens: zero IPC/sidecar/HTTP/node-gyp; latência sub-ms; bundle WASM multiplataforma; `SqlitePort` já é a abstração — só falta `SqlJsAdapter`.
Desvantagens: DB inteiro em memória (ok para <100MB, típico do EcoForms); persistência por write-back ao disco; single-threaded (mitigar com Web Worker); startup +1-3s.

**C1. Node.js sidecar + better-sqlite3 — fallback**
```
Repository (TS) → HTTP localhost:PORT → Node sidecar → better-sqlite3 → SQLite
```
Vantagens: síncrono, ACID, transações. Desvantagens: node-gyp; lifecycle do sidecar (spawn/kill/restart) sem suporte nativo robusto no Tauri; porta/CORS; latência HTTP; se o Node crashar o app fica sem banco.

**Recomendação**: POC de C2 primeiro (1 semana). Se `sql.js` servir ao perfil de dados (<100MB), elimina sidecar e HTTP. Senão, C1.

**Reimplementação em TS (~770 linhas) substituindo os módulos Rust:**

| Recurso Rust | Substituição TS | Linhas (~) |
|-------------|----------------|-----------:|
| database.rs | better-sqlite3 ou sql.js (`SqlJsAdapter`) | 200 |
| sql_guard.rs | Middleware/hook no repository | 60 |
| crypto.rs | `crypto` nativo (aes-256-gcm) | 40 |
| email.rs | `nodemailer` | 50 |
| network.rs (CEP) | `fetch` nativo | 20 |
| session.rs | Em memória (Map) | 30 |
| supabase_admin.rs | `@supabase/supabase-js` (já existe) | 80 |
| setup.rs | Script de seed JS | 40 |
| key_rotation.rs | `crypto.randomBytes` | 30 |
| rbac.rs | Middleware TS | 60 |
| lan_storage.rs | Tauri FS plugin ou `fs` | 40 |
| actions.rs | Move para UseCases TS existentes | 30 |
| audit.rs | Hook no repository | 40 |
| sync_roteiros.rs | Port para TS | 80 |
| **Total** | | **~770** |

> **`sql_guard.rs` NÃO é "desnecessário com prepared statements".** Ele faz proteções estruturais que a parametrização não cobre: (1) bloqueia leitura de `password_hash`/`hash_senha` via query genérica; (2) bloqueia DROP/ALTER em tabelas sensíveis; (3) sanitização estrutural. Precisa ser reimplementado como hook/middleware no repository TS (~60 linhas).

**Ganho líquido**: ~**2.300 linhas** a menos (3.012 Rust − 770 TS), 1 linguagem eliminada, build Cargo removido (~3-5 min de CI por build).
**Mobile não é afetado** — continua com `@capacitor-community/sqlite`. Eliminar Rust é exclusivo do desktop.
**Risco**: sql.js (memória/single-thread/persistência assíncrona, mitigável); better-sqlite3 (node-gyp + lifecycle de sidecar). Testes de regressão dos 28 comandos são indispensáveis.
**Esforço**: **3-5 semanas** (1 dev), incluindo POC de sql.js (1 semana).

> ⚠️ **O revisor diverge desta proposta — ver §6.** Em resumo: a camada Rust é o ponto mais bem testado e mais seguro do projeto (`sql_guard` com 26 testes, RBAC, AES-256-GCM, bcrypt). Trocá-la por TS para economizar ~2.300 linhas, sem CI e reimplementando as proteções à mão, é um mau negócio para um sistema com dados sob LGPD. Recomendação do revisor: **não priorizar C**; no máximo o POC de F como experimento.

#### D. Simplificar arquitetura de sync (1.909 → ~800 linhas)
**Situação**: 20 arquivos implementam event sourcing (EventEnvelope, HandlerRegistry, Transport/Inbound, gap tracking, manifest, crypto layer).
**Proposta candidata**: Supabase Realtime (online) + last-write-wins por timestamp + CRDT leve (yjs/automerge) só para formulários com merge multi-dispositivo.
**Risco**: **alto sem estudo de requisitos offline** — o sync existe porque offline-first é requisito de negócio; last-write-wins perde dados em edições concorrentes que o event sourcing resolve.
**Pré-requisito**: estudo de requisitos offline (1-2 semanas) **antes** de estimar.
**Esforço**: **3-4 semanas** após o estudo.

### 4.3 TIER 3 — Alto esforço, impacto variável

#### E. Unificar renderização mobile + desktop
- **Opção A** — Mobile com React + Capacitor: reutiliza componentes do desktop; risco: portar ~48.8K linhas de JS vanilla é **3-6 meses**.
- **Opção B** — Web Components (Lit/Stencil): framework-agnostic; overhead de interop com React.
- **Opção C** — Componentizar só o core do mobile para `ecoforms-core`: sem reescrever UI, compartilha lógica; **4-6 semanas**; não resolve duplicação de renderização.
**Recomendação**: adiar para depois de Tier 1 + Tier 2.

#### F. `sql.js` no renderer (POC)
Promovido a **alternativa primária da Proposta C (C2)**. POC de 1-2 semanas decide entre C2 e C1.

### 4.4 TIER 4 — Radical (alto risco)

#### G. Remover Supabase (só SQLite local + LAN sync)
**Não recomendado** — Supabase resolve problemas reais (auth, storage, realtime) que justificam sua presença. Perderia multi-dispositivo fora da LAN, backup cloud, acesso remoto.

---

## 5. Resumo executivo e plano

| # | Ação | Esforço | Linhas/peso salvos | Risco | Recomendação |
|---|------|---------|--------------------|-------|--------------|
| A | Unificar mobile/standalone | 1-2 dias | ~47.000 linhas | Baixo | ✅ Fazer já |
| B | Remover deps não usadas | 2-4h | ~50-90MB | Baixo | ✅ Fazer já |
| C | Rust → TypeScript backend | 3-5 sem | ~2.300 linhas | Baixo-Médio | ⚠️ Revisor diverge — **ver §6** |
| D | Simplificar sync | 3-4 sem (+1-2 estudo) | ~1.100 linhas | Médio | ⚠️ Estudar requisitos antes |
| E | Unificar renderização | 3-6 meses (A) / 4-6 sem (C) | ~10K+ | Alto | ⤵️ Adiar |
| F | sql.js POC | 1-2 sem | — | Médio | 🔬 Fazer antes de C |
| G | Remover Supabase | — | — | Alto | ❌ Não |

### Plano sugerido
```
Semana 1:    A + B (quick wins) + iniciar POC sql.js (F)
Semana 2:    Concluir POC → decidir C2 (sql.js) vs C1 (sidecar)
Semana 3-6:  C (migração Rust → TS na arquitetura escolhida)
Semana 7-8:  Estudo de requisitos offline para D
Semana 9-11: D (se viável)
Semana 12+:  Decisão sobre E
```

### Resultado esperado após Tier 1 + Tier 2

| Métrica | Antes (real) | Depois (estimado) |
|---------|-------------|-------------------|
| Linguagens | 3 (Rust, TS, JS) | 2 (TS, JS) |
| Toolchains | 4 (cargo, next, esbuild, gradle) | 3 |
| Linhas (sem standalone) | ~80K | ~77.7K (−3.0K Rust +0.7K TS) |
| Linhas (com merge standalone) | ~127K | ~80K |
| Build limpo | ~8 min | ~4 min |
| Setup novo dev | Rust + Node + Android SDK | Node + Android SDK |

> Ganho líquido de linhas pela migração Rust: **~2.300** (3.012 eliminadas − 770 reimplementadas). A eliminação de ~47K do standalone é independente.

> **Nota:** o "Plano sugerido" acima é a leitura neutra dos rascunhos originais (que tratavam C como prioridade). O **§6 abaixo registra o parecer do revisor**, que reordena as prioridades e desaconselha C. Em caso de conflito, o §6 prevalece.

---

## 6. Parecer do revisor — o que priorizar e o que não fazer

> Adicionado em 2026-06-11, cruzando este plano com a `AUDITORIA-2026-06-11.md`. As seções 1-5 são a análise; esta é a recomendação de execução.

### 6.1 Faria já, sem hesitar: B + A

São os únicos itens com ganho real **e** risco quase nulo:
- **B (remover deps)** — 2-4h, tira 50-90MB e superfície de vulnerabilidade de pacotes que nem são importados (`duckdb`, `express`, `cors`). Não há contra-argumento.
- **A (unificar mobile/standalone)** — mais que as ~47K linhas, elimina a ambiguidade "qual diretório eu edito?", que é fonte de bug toda vez que alguém corrige o fork errado.

### 6.2 Onde o revisor diverge: **C (eliminar o Rust) — não priorizar**

O plano enquadra o Rust como "3ª linguagem a eliminar" e vende ~2.300 linhas economizadas. Cruzado com a auditoria, é um mau negócio:

- A auditoria aponta a **camada Rust como a parte mais bem testada e mais segura de todo o projeto**: `sql_guard.rs` (26 testes, defesa estrutural de SQL), RBAC revalidado em Rust, AES-256-GCM, bcrypt. Em contraste, o mobile JS concentra 65 pontos de `innerHTML` (XSS) e arquivos-deus de 2.345 linhas.
- Migrar isso para TS significa **reimplementar `sql_guard`, crypto, RBAC e key-rotation à mão** — sem o type-safety do Rust e, hoje, **sem CI para pegar a regressão**. Num sistema com dados sob LGPD, é assim que se introduz um furo de auth silencioso.
- O argumento de "3 fronteiras de linguagem por query" é fraco: IPC é sub-ms, não é gargalo de um app de formulários.

**Conclusão:** o Rust aqui é **ativo, não dívida**. Economizar 2.300 linhas ao custo da única camada de segurança madura não compensa. No máximo, fazer o POC de F como experimento de aprendizado, sem compromisso de arrancar o Rust.

### 6.3 A simplificação de maior valor não está na lista A-G

É o que a auditoria chama de **Marco 0 + Marco 2**, e rende mais que reescrever o Rust:
1. **CI + scripts de teste rodando** — os testes já existem (`vitest run` agora configurado), falta o gate. Sem isso, qualquer refator de C/D é roleta-russa.
2. **Expurgar o peso morto rastreado** — `mobile_standalone/` (452 arquivos), duplicatas órfãs na raiz (~50), `.sqlite`/`.db` versionados, PII em `download/`. Reduz mais confusão e risco que reescrever o Rust, com fração do esforço.

### 6.4 Ordem de execução recomendada

| Prioridade | Item | Porquê |
|---|---|---|
| 1. Agora | **B**, depois **A** | Ganho real, risco ~zero |
| 2. Antes de qualquer refator | **Marco 0 da auditoria** (CI + testes) | Rede de segurança obrigatória |
| 3. Junto/depois do CI | **Marco 2 da auditoria** (expurgo de peso morto) | Maior ganho de clareza por hora |
| 4. Experimento opcional | **F** (POC sql.js, 1-2 sem) | Aprende sem se comprometer |
| Adiar/condicionar | **D** | Só após estudo de requisitos offline **e** CI |
| Não fazer | **C, E, G** | C troca segurança por LOC; E é meses de risco; G perde serviços reais |

**Princípio que orienta a ordem:** nada que toque código crítico (C, D) antes de existir CI. Simplificação que aumenta risco não é simplificação.

---

## Anexo A — Decisão C1 vs C2 (sidecar HTTP vs sql.js no renderer)

| Critério | C1: Sidecar + better-sqlite3 | C2: sql.js (WASM) no renderer |
|----------|------------------------------|-------------------------------|
| Latência por query | ~0.5ms (localhost HTTP) | ~0.1ms (in-process) |
| Compilação nativa | Sim (node-gyp) | Não (WASM) |
| Setup de dev | Node.js + sidecar config | Sem sidecar |
| Uso de memória | Processo separado (~50MB) | DB inteiro em RAM (<100MB) |
| Persistência | Arquivo .sqlite direto | Write-back assíncrono via FS plugin |
| Concorrência | Não bloqueia UI | Single-thread (bloqueia sem Web Worker) |
| Lifecycle | Alto (spawn/kill/restart/port) | Baixo (carrega WASM) |
| Startup | +1-2s (sidecar boot) | +1-3s (WASM + DB load) |
| Distribuição | Binário Node por plataforma | Um bundle WASM, multiplataforma |
| Mobile (futuro) | Incompatível (sem Node no Android) | Viável com Capacitor + WASM |

Arquitetura mínima (com sql.js): adicionar `SqlJsAdapter.ts` (implements `SqlitePort`) e `SqlGuardMiddleware.ts` (~60 linhas, substitui `sql_guard.rs`). Os 28 repositórios e 17 queries **não mudam**.

---

## Anexo B — Por que NeDB foi rejeitado

> Origem deste anexo: a pergunta inicial era migrar o backend para **Node.js + NeDB**. A análise abaixo é o motivo de a parte "NeDB" ter sido descartada — a parte "Node.js" sobreviveu como Proposta C.

### O que é o NeDB
Banco embedded para Node.js, estilo MongoDB; armazenamento em arquivo JSON por coleção; API assíncrona; **sem schema, sem JOINs, sem SQL, sem transações ACID**.

### Compatibilidade por recurso

| Recurso SQLite | NeDB | Compatibilidade |
|---------------|------|-----------------|
| `SELECT ... WHERE` | `db.find({...})` | Parcial |
| `JOIN` | lookup manual / embed | **Incompatível** |
| `GROUP BY` + agregações | código JS | **Incompatível** |
| `ORDER BY` / `LIMIT` / `OFFSET` | `.sort/.limit/.skip` | Compatível |
| `INSERT` / `UPDATE` / `DELETE` | `.insert/.update/.remove` | Compatível |
| `TRANSACTION` | nenhum | **Incompatível** |
| `FOREIGN KEY` / `CHECK` | nenhum | **Incompatível** |
| `UNIQUE` | `ensureIndex({unique})` | Parcial |
| `SUBQUERY` / `CTE` / `CASE WHEN` / `PRAGMA` | nenhum | **Incompatível** |

### Impacto
- 60-80% dos repositórios usam JOINs; ~20% usam GROUP BY; ~10% usam subqueries/CTE. Cada um exigiria N+1 queries + join manual em JS.
- Os 17 arquivos de queries (CASE WHEN, GROUP BY/HAVING, window functions, subqueries correlacionadas) precisariam ser reescritos como procedimentos JS (~3-5x mais código).
- Estimativa de impacto: **+8.000 a 12.000 linhas** (vs. ~770 da Proposta C com SQLite preservado).
- **Risco de integridade** com dados governamentais (ouvidoria/LGPD, logística): sem ACID/FK/UNIQUE → dados órfãos, race conditions, duplicação, perda silenciosa.

### Veredito
❌ **NeDB rejeitado.** O custo de reescrita supera o ganho de simplificação em 3-4x, com perda de integridade. ✅ A conclusão aproveitável: **eliminar Rust, manter SQLite** — exatamente a Proposta C (via `sql.js` ou better-sqlite3).

### Anexo B.1 — Comparação técnica dos bancos

| Característica | SQLite | NeDB | better-sqlite3 |
|---------------|--------|------|----------------|
| Tipo | Relacional | Documento | Relacional |
| ACID / JOINs / Transações | Sim | Não | Sim |
| Limites práticos | ~1TB | ~500MB (degrada) | ~1TB |
| Latência | <1ms | 2-5ms | <0.5ms (síncrono) |
| Compilação nativa | C | Nenhuma | C (pré-binários) |
| Mobile (Android) | Via plugin Capacitor | JS puro | Incompatível |
| Manutenção | 20+ anos | original 2015 (fork `nedb-promises` ativo) | ativo |
