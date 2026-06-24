# Análise de Viabilidade: Migração Backend para Node.js + NeDB

> **Data**: 2026-06-11
> **Autor**: Context-mode (análise automatizada do codebase)
> **Contexto**: Avaliação da proposta de migrar o backend desktop e mobile de Rust/SQLite para Node.js + NeDB.
> **Documento complementar**: `2026-06-11-ANALISE-SIMPLIFICACAO-ARQUITETURA.md`

---

## 1. Stack Atual — Mapeamento Completo

### 1.1 Desktop (ecosuite-desktop)

| Camada | Tecnologia | Detalhes |
|--------|-----------|----------|
| Shell nativo | Tauri 2.9 | Gerencia janela, FS, diálogos, shell |
| Frontend | Next.js 16 + React 19 | Radix UI, Tailwind 4, TanStack Query |
| Backend | Rust (17 arquivos, ~3K linhas) | database.rs, sql_guard.rs, session.rs, etc. |
| Banco de dados | SQLite via rusqlite | Arquivo .sqlite local, WAL mode |
| Cloud | Supabase (PostgreSQL) | Auth, storage, realtime, admin queries |
| Core compartilhado | `ecoforms-core` (TypeScript) | Abstrai `SqlitePort`, domínio, sync |

### 1.2 Mobile (ecoforms / Capacitor)

| Camada | Tecnologia | Detalhes |
|--------|-----------|----------|
| Shell nativo | Capacitor 8 (Android) | Gradle build, plugins nativos |
| Frontend | Vanilla JS + Tailwind | Sem framework, renderização manual |
| Banco de dados | `@capacitor-community/sqlite` | Plugin nativo, arquivo .sqlite local |
| Cloud | Supabase | Auth, storage |
| Build | esbuild + Capacitor | Scripts custom, Android SDK |

### 1.3 Camada de Abstração — `SqlitePort`

```typescript
// packages/core/src/ports/SqlitePort.ts
export interface SqlitePort {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    execute(sql: string, params?: unknown[]): Promise<void>;
    transaction<T>(callback: () => Promise<T>): Promise<T>;
}
```

**Implementações concretas**:
- **Desktop**: `TauriSqliteAdapter` → `invoke('db_query'/'db_execute')` → Rust → rusqlite → SQLite
- **Mobile**: Adapter Capacitor direto

### 1.4 Comandos Rust Registrados (28 comandos Tauri)

| Categoria | Comandos | Arquivo(s) Rust |
|-----------|----------|-----------------|
| **Banco de dados** | `db_connect`, `db_query`, `db_execute`, `db_execute_batch`, `db_last_insert_id`, `db_export_for_mobile` | `database.rs` |
| **Sessão** | `set_session`, `clear_session`, `get_session` | `session.rs` |
| **Autenticação** | `verify_password`, `hash_password` | `lib.rs` (bcrypt + SHA-256) |
| **Email** | `send_email`, `test_email_connection` | `commands/email.rs` |
| **Criptografia** | `load_crypto_key`, `encrypt_payload`, `decrypt_payload` | `commands/crypto.rs` |
| **Key rotation** | `rotate_sync_salt`, `recover_sync_salt`, `list_salt_history` | `commands/key_rotation.rs` |
| **RBAC** | `commands::rbac::*` | `commands/rbac.rs` |
| **Setup** | `create_first_admin` | `commands/setup.rs` |
| **Audit** | `commands::audit::*` | `commands/audit.rs` |
| **Actions** | `demanda_aceitar`, `demanda_encerrar`, `ecoponto_agendar_remocao` | `commands/actions.rs` |
| **Rede** | `network_probe_path`, `network_list_parquet`, `network_write_parquet`, `fetch_cep` | `network.rs` |
| **Supabase** | `supabase_admin_query`, `supabase_admin_status` | `supabase_admin.rs` |
| **LAN storage** | `lan_read_file`, `lan_write_file`, `lan_list_dir` | `commands/lan_storage.rs` |
| **Sync** | `sync_roteiros_externos`, `sync_roteiros_status` | `commands/sync_roteiros.rs` |
| **UI** | `toggle_devtools` | `lib.rs` |

### 1.5 Repositórios TypeScript que acessam SQLite

**29 repositórios** na pasta `desktop/src/infrastructure/persistence/sqlite/`:

| # | Repositório | Tabela(s) Principal(is) |
|---|------------|------------------------|
| 1 | SqliteAgendamentoRepository | agendamentos |
| 2 | SqliteAgendamentoNotificacaoRepository | notificacoes_agendamento |
| 3 | SqliteClienteRepository | clientes |
| 4 | SqliteDataRegistryRepository | registro_dados |
| 5 | SqliteDecisionRegistryRepository | decisions |
| 6 | SqliteDemandaRepository | demandas |
| 7 | SqliteEcopontoRepository | ecoponto_caixas |
| 8 | SqliteEmailConfigRepository | tbl_email_config |
| 9 | SqliteExecucaoClienteRepository | execucoes_cliente |
| 10 | SqliteHierarquiaPerfilRepository | hierarquia_perfil |
| 11 | SqliteKanbanRepository | kanban_*
| 12 | SqliteLogisticsRepository | logistica_*
| 13 | SqliteManifestacaoRepository | manifestacoes, respostas |
| 14 | SqliteModuleRepository | modules |
| 15 | SqliteModuleVisualViewRepository | module_visual_views |
| 16 | SqliteNotificacaoSolicitanteRepository | notificacoes_solicitante |
| 17 | SqliteProjectRepository | projetos |
| 18 | SqliteServiceSlotRepository | service_slots |
| 19 | SqliteServiceTypeRepository | service_types |
| 20 | SqliteSetorRepository | setores |
| 21 | SqliteSuiteRepository | pacotes, pacote_items |
| 22 | SqliteTaskMetricsRepository | task_metrics |
| 23 | SqliteTaskRepository | tasks (267 linhas, queries complexas) |
| 24 | SqliteTipoPrazoRepository | tipos_prazo |
| 25 | SqliteTipoResiduoRepository | tipos_residuo |
| 26 | SqliteUserRepository | users |
| 27 | SqliteUserWidgetInstanceRepository | user_widget_instances |
| 28 | SqliteViewRegistryRepository | view_registry |
| 29 | SqliteDecisionRegistryRepository | decisions |

**+ 15 arquivos de queries parametrizadas** em `queries/`:
`analysis.ts`, `classificacao.ts`, `data-registry.ts`, `forms.ts`, `inbox.ts`, `kanban.ts`, `logistica.ts`, `manifestacoes.ts`, `modules.ts`, `pacotes.ts`, `projetos.ts`, `service.ts`, `solicitacoes.ts`, `system.ts`, `tarefas.ts`, `usuarios.ts`, `_types.ts`

---

## 2. Análise do NeDB como Substituto do SQLite

### 2.1 O que é o NeDB

- Banco de dados **embedded** para Node.js, inspirado no MongoDB
- Armazenamento em **arquivo JSON** por coleção (ou in-memory)
- API **assíncrona** estilo MongoDB (`insert`, `find`, `update`, `remove`)
- **Sem schema enforcement**, **sem JOINs**, **sem SQL**, **sem transações ACID**
- Tamanho típico: ~200KB (biblioteca), sem dependências nativas

### 2.2 Análise de Compatibilidade por Recurso

| Recurso SQLite | NeDB equivalente | Compatibilidade |
|---------------|-----------------|-----------------|
| `SELECT ... WHERE ...` | `db.find({ campo: valor })` | Parcial — sem operadores SQL complexos |
| `JOIN` | Nenhum — requer lookup manual ou embed | Incompatível |
| `GROUP BY + agregações` | Nenhum nativo — requer código JS | Incompatível |
| `ORDER BY` | `.sort({ campo: 1 })` | Compatível |
| `LIMIT / OFFSET` | `.skip(n).limit(m)` | Compatível |
| `INSERT` | `.insert(doc)` | Compatível |
| `UPDATE com WHERE` | `.update(query, { $set: ... })` | Compatível |
| `DELETE com WHERE` | `.remove(query)` | Compatível |
| `TRANSACTION` | Nenhum — sem_atomicidade | Incompatível |
| `FOREIGN KEY` | Nenhum — sem constraints | Incompatível |
| `UNIQUE constraint` | Índice `db.ensureIndex({ fieldName, unique })` | Parcial |
| `SUBQUERY` | Nenhum | Incompatível |
| `CTE (WITH ...)` | Nenhum | Incompatível |
| `CASE WHEN` | Lógica JS no código | Incompatível |
| `PRAGMA` | Nenhum | Incompatível |

### 2.3 Impacto nos Repositórios

**Exemplo real** — `SqliteTaskRepository.ts` (267 linhas):

```sql
SELECT t.*, s.titulo AS suite_titulo, s.status AS suite_status,
       p.nome AS projeto_nome, u.nome AS atribuido_nome
FROM tasks t
LEFT JOIN pacotes s ON t.suite_id = s.id
LEFT JOIN projetos p ON t.projeto_id = p.id
LEFT JOIN users u ON t.atribuido_para = u.id
WHERE t.status = ? AND t.arquivado = 0
ORDER BY t.ordem, t.criado_em DESC
```

**NeDB equivalente**: requereria 4 queries separadas (`tasks`, `pacotes`, `projetos`, `users`) + join manual em JavaScript. Para cada query com JOIN nos 29 repositórios, teríamos:

- **Queries com JOIN**: estimativa de 60-80% dos repos usam JOINs
- **Queries com GROUP BY**: ~20% dos repos (dashboards, métricas, relatórios)
- **Queries com subqueries/CTE**: ~10% (kanban, análise, logística)

### 2.4 Impacto nas Queries Parametrizadas

Os 15 arquivos em `queries/` contêm queries SQL extensas com:
- Múltiplos JOINs
- CASE WHEN para pivôs
- GROUP BY com HAVING
- Window functions (ROW_NUMBER, LAG)
- Subqueries correlacionadas

**Migração para NeDB**: cada query SQL precisaria ser reescrita como **procedimento JavaScript** com múltiplos `find()` e joins manuais. Estimativa: **3-5x mais código** por query.

---

## 3. Avaliação por Dimensão

### 3.1 Viabilidade Técnica

| Dimensão | Nota | Justificativa |
|----------|------|--------------|
| Substituição de queries simples | ✅ Viável | CRUDs básicos (insert, find by id, update) funcionam |
| Substituição de queries complexas | ❌ Inviável | JOINs, GROUP BY, CTEs, subqueries — NeDB não suporta |
| Transações | ❌ Inviável | NeDB não tem ACID — `SqlitePort.transaction()` fica sem implementação |
| Constraints e integridade | ❌ Inviável | Sem FK, UNIQUE automático, CHECK — validação toda no código |
| Performance em datasets grandes | ⚠️ Problemático | NeDB carrega coleção inteira em memória; logística e ouvidoria podem ter 100K+ registros |
| Portabilidade mobile | ✅ Viável | `nedb-promises` funciona em qualquer runtime JS |
| Zero dependências nativas | ✅ Viável | NeDB é JS puro, sem node-gyp |

### 3.2 Impacto no Código

| Área | Linhas atuais | Estimativa pós-NeDB | Variação |
|------|--------------|---------------------|----------|
| 29 repositórios | ~3.500 | ~8.000-10.000 | +130-185% |
| 15 arquivos de queries | ~2.000 | ~6.000-8.000 | +200-300% |
| `TauriSqliteAdapter` | 47 | ~120 (NeDBAdapter) | +155% |
| `database.rs` (a eliminar) | 546 | 0 | -100% |
| `sql_guard.rs` (a eliminar) | 320 | 0 | -100% |
| **Impacto líquido** | | | **+8.000-12.000 linhas** |

### 3.3 Impacto na Integridade de Dados

O sistema EcoForms lida com **dados governamentais** (ouvidoria, logística, ecopontos, demandas). Sem transações ACID e constraints:

1. **Risco de dados órfãos**: Sem FK, um registro pode referenciar outro que foi deletado
2. **Risco de race conditions**: Sem `BEGIN/COMMIT`, operações multi-tabela podem ficar inconsistentes
3. **Risco de duplicação**: Sem UNIQUE constraint, emails, CPFs e IDs podem ser duplicados
4. **Risco de perda silenciosa**: Sem WAL mode, crash no momento de escrita pode corromper

---

## 4. Propostas Alternativas

### Proposta A: Node.js + better-sqlite3 (RECOMENDADA)

**Conceito**: Eliminar Rust, manter SQLite, trocar apenas a camada de acesso.

```
React Component
   → UseCase (TypeScript)
     → Repository (TypeScript) — monta SQL + parâmetros
       → NodeSqliteAdapter implements SqlitePort
         → better-sqlite3 → SQLite (mesmo arquivo .sqlite)
```

**Vantagens**:
- **Zero mudança nos 29 repositórios e 15 queries** — `SqlitePort` é a mesma interface
- Elimina 17 arquivos Rust (~3K linhas)
- Elimina toolchain Rust do setup de dev e CI/CD
- `better-sqlite3` é síncrono e performático (~1.2M ops/s)
- Transações ACID preservadas
- Constraints e integridade preservadas

**Desvantagens**:
- `better-sqlite3` requer compilação nativa (node-gyp) — mas pré-binários existem para Windows/macOS/Linux
- No mobile, `better-sqlite3` não roda — manter `@capacitor-community/sqlite`

**Esforço**: 2-3 semanas (1 dev).

| Recurso Rust | Substituição Node.js | Linhas estimadas |
|-------------|---------------------|-----------------|
| `database.rs` | `better-sqlite3` (síncrono) | ~200 |
| `sql_guard.rs` | Desnecessário (prepared statements) | 0 |
| `crypto.rs` | `crypto` nativo (aes-256-gcm) | ~40 |
| `email.rs` | `nodemailer` | ~50 |
| `network.rs` (CEP) | `fetch` nativo | ~20 |
| `session.rs` | Em memória (Map) | ~30 |
| `supabase_admin.rs` | `@supabase/supabase-js` (já existe) | ~80 |
| `setup.rs` | Script de seed JS | ~40 |
| `key_rotation.rs` | `crypto.randomBytes` | ~30 |
| `rbac.rs` | Middleware JS | ~60 |
| `lan_storage.rs` | `fs` nativo | ~40 |
| `actions.rs` | Move para UseCases TS | ~30 |
| `audit.rs` | Hook no repository | ~40 |
| `sync_roteiros.rs` | Port para TS | ~80 |
| **Total** | | **~700** |

**Recomendação**: ✅ **Forte** — Melhor custo-benefício. Elimina Rust, preserva investimentos em SQL.

---

### Proposta B: NeDB apenas para dados simples + SQLite para dados relacionais (HÍBRIDA)

**Conceito**: Usar NeDB para configs, cache e sync queue; manter SQLite para dados transacionais.

```
┌─────────────────────────────────────────┐
│  ConfigPadraoAdapter (NeDB)            │
│  - registro_dados (tipo='config')      │
│  - preferências do usuário             │
│  - cache de formulários                │
│  - fila de sync offline                │
├─────────────────────────────────────────┤
│  RepositoryAdapter (SQLite/better-sqlite3) │
│  - tasks, demandas, ecopontos         │
│  - logística, ouvidoria               │
│  - usuários, permissões               │
│  - kanban, agendamentos               │
└─────────────────────────────────────────┘
```

**Vantagens**:
- NeDB resolve casos simples sem compilação nativa
- SQLite preserva integridade para dados críticos
- Mobile pode usar NeDB para configs offline (sem plugin nativo)

**Desvantagens**:
- Duas engines de banco = complexidade adicional
- Necessita roteamento de qual adapter usar por entidade
- `SqlitePort` precisaria ser estendido ou duas interfaces coexistiriam

**Esforço**: 3-4 semanas.

**Recomendação**: ⚠️ **Avaliar após Proposta A** — Adiciona complexidade imediata sem ganho proporcional.

---

### Proposta C: NeDB puro (original, REJEITADA)

**Conceito**: Substituir SQLite completamente por NeDB em ambas as plataformas.

**Razões para rejeição**:

| Razão | Detalhe |
|-------|---------|
| Sem JOINs | 60-80% dos repos usam JOINs — exigiria N+1 queries ou embed denormalizado |
| Sem transações | `SqlitePort.transaction()` fica sem implementação real |
| Sem constraints | FK, UNIQUE, CHECK teriam que ser reimplementados no TS |
| Performance | Coleções >50K registros ficam lentas (full scan) |
| Integridade | Dados governamentais sem ACID = risco regulatório |
| Esforço | 8-10 sprints para reescrever todos os repos e queries |

**Recomendação**: ❌ **Não** — O custo-benefício é negativo. O esforço de reescrita supera em 3-4x qualquer ganho de simplificação.

---

## 5. Impacto por Plataforma

### 5.1 Desktop

| Aspecto | NeDB puro | Node.js + better-sqlite3 | Atual (Rust + rusqlite) |
|---------|-----------|--------------------------|------------------------|
| Compilação nativa | Nenhuma | node-gyp (pré-binários) | Cargo (3-5 min) |
| Linguagem backend | JS/TS | JS/TS | Rust |
| Queries complexas | Reescrita total | Sem mudança | OK |
| Integridade de dados | Sem garantia | ACID completo | ACID completo |
| Latência p/ query | ~2-5ms | ~0.3ms | ~0.5ms (+ IPC) |
| Tamanho do binário | Menor | Menor que Rust | ~15MB Rust |
| Setup novo dev | npm install | npm install | npm install + Rust toolchain |

### 5.2 Mobile

| Aspecto | NeDB puro | melhor-sqlite3 | @capacitor-community/sqlite (atual) |
|---------|-----------|----------------|--------------------------------------|
| Plugin nativo | Nenhum | Necessário (não existe p/ Android) | Já existe |
| Offline | OK | N/A | OK |
| Integridade | Sem garantia | N/A | ACID completo |
| Compatibilidade Android | OK (JS puro) | Incompatível (C addon) | OK (nativo) |

**No mobile**, `better-sqlite3` **não roda** em Android/Capacitor. A solução é manter `@capacitor-community/sqlite` para dados relacionais e opcionalmente adicionar NeDB para cache/configs.

---

## 6. Decisão e Próximos Passos

### Decisão Recomendada

**Adotar a Proposta A (Node.js + better-sqlite3)** como estratégia principal para o desktop, mantendo SQLite como motor de persistência.

**Rejeitar a Proposta C (NeDB puro)** como substituto do SQLite.

**Arquivar a Proposta B (Híbrida)** para reavaliação futura, caso surjam requisitos de simplificação do mobile.

### Roadmap Sugerido

```
FASE 1 — Validação (1 semana)
├── POC: NodeSqliteAdapter implements SqlitePort com better-sqlite3
├── Benchmark: queries típicas vs. Tauri IPC
├── Teste: rodar 10 repos contra o adapter
└── Go/No-Go decision

FASE 2 — Migração Desktop (2 semanas)
├── Implementar NodeSqliteAdapter completo
├── Reescrever 28 comandos Rust em TypeScript
├── Reescrever crypto, email, session, RBAC em TS
├── Testes de regressão em todos os fluxos
└── Eliminar pasta src-tauri/src/ (manter apenas shell)

FASE 3 — Validação Mobile (1 semana)
├── Confirmar que @capacitor-community/sqlite permanece
├── Avaliar NeDB para cache offline no mobile
└── Atualizar documentação de arquitetura
```

### Métricas de Sucesso

| Métrica | Antes | Depois (esperado) |
|---------|-------|-------------------|
| Linguagens no backend | 2 (Rust + TS) | 1 (TS) |
| Arquivos Rust | 17 | 0 |
| Tempo de build limpo | ~8 min | ~4 min |
| Setup novo dev | Node + Rust + Android SDK | Node + Android SDK |
| Linhas de backend | ~3.000 (Rust) + ~10.000 (TS infra) | ~700 (Node) + ~10.000 (TS infra) |
| IPC calls por query | 1 (Tauri IPC) | 0 (processo direto) |
| Complexidade de deploy | 2 toolchains | 1 toolchain |

---

## 7. Anexo — Comparação Técnica dos Bancos

| Característica | SQLite | NeDB | better-sqlite3 |
|---------------|--------|------|----------------|
| Tipo | Relacional, embedded | Documento, embedded | Relacional, embedded |
| Formato de arquivo | .sqlite binário | .json por coleção | .sqlite binário |
| Schema | Rigoroso (DDL) | Livre (schemaless) | Rigoroso (DDL) |
| ACID | Sim | Não | Sim |
| JOINs | Sim | Não | Sim |
| Transações | Sim | Não | Sim |
| Índices | B-tree | In-memory hash | B-tree |
| Limites práticos | ~1TB | ~500MB (degradação) | ~1TB |
| Latência típica | <1ms | 2-5ms | <0.5ms (síncrono) |
| Concorrência | WAL mode (read/write concorrente) | Serial (lock global) | Serial (single writer) |
| Compilação nativa | Biblioteca C | Nenhuma | Biblioteca C (pré-binários) |
| Mobile (Android) | Via plugin Capacitor | JS puro | Incompatível |
| Maturidade | 20+ anos | 10+ anos, sem manutenção ativa | 5+ anos, ativo |
| Último release | 2025 | 2015 (original), fork `nedb-promises` ativo | 2025 |

---

## 8. Conclusão

A migração para **Node.js puro** é **viável e recomendável** (Proposta A). Eliminar o Rust reduz complexidade, toolchain e tempo de build sem sacrificar funcionalidade.

A migração para **NeDB** como substituto do SQLite é **inviável** para o caso do EcoForms. O sistema depende extensivamente de queries relacionais (JOINs, GROUP BY, transações, constraints) que o NeDB não suporta. O esforço de reescrita seria 3-4x maior que o ganho de simplificação, com perda de integridade de dados.

A recomendação final é: **Eliminar Rust, manter SQLite, implementar `NodeSqliteAdapter`**.