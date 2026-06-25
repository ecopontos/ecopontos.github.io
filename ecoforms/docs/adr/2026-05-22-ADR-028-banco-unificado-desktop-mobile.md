# ADR-028 — Banco Único Desktop/Mobile: SQLite Nativo com Schema Unificado e Provisão Direta

- **Status**: **Implementado** (ADR-052 criou CapacitorSqliteAdapter + MobileSchemaBootstrap + IndexedDbMigration; ADR-028 completou eliminação de todas as referências SyncEventDB das 11 consumer files — HTML pages, SyncAdapter, SyncBootstrap, ActivityService, sync/index.js)
- **Auditoria**: 2026-06-18
- **Data**: 2026-05-22
- **Autor**: Marcelo Luiz + Claude Code
- **Decisor**: Pendente de aprovação
- **Ciclo de vida**: Proposto → Aceito → Implementado → Supersedido
- **Supersede**: ADR-027 Seção 9 (Provisão mobile via JSON/IndexedDB — schema key-value uniforme)
- **Relacionados**: ADR-027 (LAN Sync — infraestrutura de distribuição de arquivos), ADR-020 (Granular Sync), ADR-014 (Adequação Arquitetural — paridade mobile/desktop)

---

## Contexto

### Situação atual — dois bancos, dois schemas, dois backends

O projeto mantém dois formatos de banco completamente diferentes entre desktop e mobile:

**Desktop** (Next.js + Tauri):
- SQLite nativo via Rust (`src-tauri/src/database.rs`) com `rusqlite`
- Schema relacional completo: `schema_ddl.sql` com 76 tabelas (51 de domínio + 19 legadas + 6 de sync), colunas tipadas, foreign keys, índices
- Acesso via repositórios `Sqlite*Repository` em `src/infrastructure/persistence/sqlite/`
- Queries parametrizadas, JOINs, transações ACID

**Mobile** (Capacitor Android):
- `sql.js` (SQLite compilado para WASM) em memória
- Schema uniforme key-value em todas as 12 tabelas:
  ```sql
  CREATE TABLE IF NOT EXISTS [nome] (id TEXT PRIMARY KEY, data TEXT NOT NULL)
  -- data = JSON.stringify(registro_completo)
  ```
- Persistência via IndexedDB (`SyncEventDB` — `sdb-snapshot`)
- Toda query é `SELECT data WHERE id = ?` ou `INSERT INTO ... (id, data) VALUES (?, json)` — sem JOINs, sem índices compostos, sem transações entre tabelas
- Queries indexadas via `json_extract(data, '$.campo')` — lento, frágil, sem otimização de query planner

### Problemas identificados

| Problema | Impacto |
|---|---|
| **Duplo schema** — qualquer alteração no desktop exige mapear campos para o formato JSON mobile | ~2x esforço de manutenção por feature; bugs de dessincronização entre os dois formatos são frequentes |
| **Queries diferentes** — desktop usa SQL com JOINs; mobile usa `json_extract` | Impossível compartilhar código de acesso a dados; cada query é reescrita duas vezes |
| **Sem integridade referencial no mobile** — FK não existe em JSON blob | Dados órfãos no mobile que só aparecem na próxima sincronização |
| **Sem transações entre tabelas** — sql.js WASM + IndexedDB não suporta transações cross-table | Corrupção parcial em caso de erro durante sync |
| **Provisionamento ineficiente** — ADR-027 Seção 9 propõe gerar `.db` com schema key-value a partir do SQLite desktop | Pipeline de tradução desktop→mobile adiciona latência e ponto de falha |
| **Duas camadas de sync** — mobile tem `SyncEventDB` (sql.js) + `DataService` (IndexedDB); desktop tem SQLite direto | Complexidade desnecessária; lógica de negócio fragmentada entre dois paradigmas de persistência |
| **Capacitor não usa SQLite nativo** — sql.js WASM é um workaround, não o caminho natural do ecossistema Android | Performance subótima; limite de memória do WASM; loading time maior |
| **sql.js não está no `package.json`** — importado dinamicamente (`import('sql.js')`) como bare specifier sem resolução | O app mobile atual está quebrado em runtime — `import('sql.js')` falha no browser/Capacitor WebView sem bundler ou import map |

---

## Decisão

**Unificar o banco de dados: o app mobile (APK) passará a usar SQLite nativo com o mesmo schema relacional do desktop.**

O schema canônico passa a ser `schema_ddl.sql` — um único arquivo, um único formato, tanto para desktop quanto para mobile. O desktop, em modo admin, exporta o arquivo `.db` binário diretamente para provisionamento do mobile — sem tradução, sem key-value intermediário, sem `json_extract`.

### Princípio

```
Antes:
  Desktop: SQLite nativo → schema relacional (76 tabelas tipadas)
  Mobile:  sql.js WASM → schema key-value (12 tabelas uniformes)
  Provisão: Desktop → extrai JSON → gera .db key-value → mobile importa blob no IndexedDB

Depois:
  Desktop: SQLite nativo → schema_ddl.sql
  Mobile:  SQLite nativo → schema_ddl.sql (mesmo arquivo)
  Provisão: Desktop → copia .db binário → mobile abre direto
```

---

## 1. Migração do mobile para SQLite nativo

### 1.1 Plugin Capacitor SQLite

Substituir `sql.js` (WASM) por `@capacitor-community/sqlite` ou plugin customizado com `android.database.sqlite` nativo:

| Componente atual | Substituição |
|---|---|
| `SyncEventDB.js` (sql.js WASM + IndexedDB) | `MobileDatabaseService.ts` (SQLite nativo via Capacitor plugin) |
| `DataService` (IndexedDB `FormDataDB`) | `Sqlite*Repository` (os mesmos repositórios do desktop — compartilham `SqlitePort`) |
| `_flushToIndexedDB()` / `_restoreFromIndexedDB()` | Arquivo `.db` no filesystem do Android (`/data/data/.../databases/`) |
| `_initTables()` com schema key-value | `schema_ddl.sql` completo executado via `db.execute(sql)` |

### 1.2 Schema canônico

O arquivo `desktop/schema_ddl.sql` passa a ser a fonte única de verdade do schema. O mobile executa o mesmo DDL na inicialização:

```typescript
// MobileDatabaseService.ts
const schema = await fetch('schema_ddl.sql').then(r => r.text());
for (const stmt of schema.split(';').filter(s => s.trim())) {
    await db.execute(stmt.trim());
}
```

### 1.3 Repositórios compartilháveis

Os repositórios `Sqlite*Repository` do desktop (`src/infrastructure/persistence/sqlite/`) passam a ser portáveis para mobile. A interface `SqlitePort` é a mesma — só o adapter de conexão muda:

```
Desktop: SqliteTaskRepository → TauriSqliteAdapter → rusqlite (Rust)
Mobile:  SqliteTaskRepository → CapacitorSqliteAdapter → android.database.sqlite (Java/Kotlin)
```

O contrato `SqlitePort` (já existente no desktop em `src/application/ports/SqlitePort.ts`) abstrai a engine:

```typescript
interface SqlitePort {
    query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    all<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
    execute(sql: string, params?: unknown[]): Promise<void>;
    transaction<T>(callback: () => Promise<T>): Promise<T>;
}
```

A interface `SqlitePort` já é implementada no desktop por `TauriSqliteAdapter`. A Fase 1 desta ADR cria a implementação mobile (`CapacitorSqliteAdapter`) para o mesmo contrato.

---

## 2. Exportação completa via desktop (admin)

### 2.1 Botão "Exportar Mobile" no admin

A página `/admin/exportar-mobile` já está implementada (318 linhas, `app/admin/exportar-mobile/page.tsx`) com os seguintes ajustes pendentes:

1. **Gerar .db** — ✅ Implementado. O desktop usa a API `rusqlite::backup::Backup` (cópia consistente sem bloquear o banco principal) seguida de `VACUUM` no arquivo exportado. A abordagem com `VACUUM INTO` foi substituída porque o Backup API do Rust oferece cópia non-blocking superior.
2. **Download / LAN** — ✅ Implementado. Download via base64 (Tauri `lan_read_file`), com instruções para os 3 canais de provisão (HTTP, LAN, USB).
3. **`.meta.json`** — ❌ Pendente. A exportação gera o `.db` mas não produz o arquivo de metadados com contagens e checksum.

### 2.2 Filtro de dados sensíveis

Antes da exportação, remover dados que não devem ir para o mobile:

| Removido | Motivo |
|---|---|
| `hash_senha` da tabela `usuarios` | Segurança — o mobile autentica via token, não precisa do hash |
| `sal_sync` da tabela `usuarios` | Chave de sincronização — local por dispositivo |
| `audit_log` (toda a tabela) | Log de segurança — não deve vazar entre dispositivos |
| `sync_event_queue` | Fila de transporte — local por dispositivo |
| `sync_device_log` | Log de sequência — local por dispositivo |
| `sync_gap_log`, `sync_cursor`, `sync_manifest` | Metadados de sync — locais por dispositivo |

### 2.3 Metadados de exportação

Gerar arquivo `.meta.json` junto com o `.db`:

```json
{
  "gerado_em": "2026-05-22T15:30:00Z",
  "gerado_por": "admin@org.com",
  "schema_version": 28,
  "tabelas": {
    "usuarios": 45,
    "tarefas": 230,
    "clientes": 1200,
    "data_registry": 15,
    "roteiros": 8,
    "module_registry": 6,
    "demandas": 18,
    "tbl_agendamentos": 55,
    "manifestacoes": 12,
    "setores": 10
  },
  "checksum_sha256": "a1b2c3..."
}
```

> **Nota:** Dados de ecopontos (antes listados como `tbl_ecopontos`) são armazenados como registros em `data_registry` (tipo `ecoponto`), não como tabela própria. A contagem de ecopontos está inclusa na linha `data_registry`.
> **Nota 2:** As tabelas `clientes`, `roteiros`, `demandas`, `manifestacoes` e `setores` não usam prefixo `tbl_` no schema (`schema_ddl.sql`). Apenas `tbl_service_types`, `tbl_service_slots` e `tbl_agendamentos` possuem o prefixo.

---

## 3. Provisionamento no mobile

### 3.1 Fluxo de importação

O mobile recebe o `.db` por um de três canais:
1. **Download HTTP** do desktop (modo dev/treinamento)
2. **Pasta LAN** (via `LanFileStorage` — infraestrutura ADR-027)
3. **Cabo USB / file picker** (campo, sem rede)

Ao importar:
1. Fecha conexão atual com SQLite
2. Substitui arquivo `.db` pelo novo
3. Reconecta e valida schema version
4. Executa migrations pendentes (se schema version do .db < atual)
5. Dispara sync incremental para pegar dados posteriores à exportação

### 3.2 Tela de provisionamento

Nova tela `device-setup.html` (extensão da existente) com:
- Indicador de progresso da importação
- Resumo das tabelas importadas (do `.meta.json`)
- Botão "Iniciar sincronização incremental" pós-importação
- Fallback: se nenhum `.db` disponível, cria schema vazio e sincroniza via Supabase (modo atual)

---

## 4. Impacto no sync

### 4.1 Simplificação do protocolo

Com schema unificado, o sync deixa de precisar de tradução JSON:

| Antes | Depois |
|---|---|
| `SyncEventDB` mantém fila em sql.js WASM | `MobileDatabaseService` insere direto no SQLite nativo |
| `DataService` salva no IndexedDB `FormDataDB` | Eliminado — tudo vai para o SQLite |
| `DatabaseSyncService` traduz eventos Supabase → IndexedDB | `MobileSyncService` aplica eventos Supabase → SQLite (mesmo schema) |
| Sync de formulários usa `formFieldRegistry` no IndexedDB | Formulários persistem no SQLite como registros normais |

### 4.2 Sync incremental pós-provisão

Após importar o `.db`, o mobile sincroniza apenas o delta:
1. Lê `sync_cursor` do SQLite local (último `last_event_id` processado)
2. Consulta Supabase Storage por envelopes posteriores
3. Aplica no SQLite via repositórios (não via JSON patch)
4. Atualiza `sync_cursor`

O ADR-020 (Granular Sync) e ADR-027 (LAN Sync) continuam funcionando — a infraestrutura de distribuição não muda, apenas o consumer final (SQLite nativo em vez de sql.js WASM).

---

## 5. Migração de dados existentes

### 5.1 Mobile com dados no IndexedDB

Dispositivos mobile em campo com dados no IndexedDB/sql.js precisam de migração:

1. **Detecção**: ao atualizar o APK, `MobileDatabaseService` verifica se existe `sdb-snapshot` no IndexedDB
2. **Extração**: lê todas as tabelas do sql.js e insere no SQLite nativo (com tradução de JSON blob → colunas tipadas)
3. **Validação**: confere contagem de registros por tabela entre sql.js e SQLite nativo
4. **Limpeza**: após validação bem-sucedida, remove `sdb-snapshot` e `FormDataDB` do IndexedDB
5. **Rollback**: em caso de falha, mantém sql.js como fallback e reporta erro

### 5.2 Script de migração

```typescript
// migrate/MigrationV1_SqlJsToNative.ts
async function migrateFromSqlJs(nativeDb: SqlitePort): Promise<MigrationReport> {
    const sqlJsDb = await SyncEventDB.openSyncEventDB(); // instância legada
    const stores = ['usuarios', 'tarefas', 'clientes', 'roteiros', 'demandas', 'data_registry', 'module_registry', /* ... */];
    const report: MigrationReport = { migrated: {}, errors: [] };

    for (const store of stores) {
        try {
            const rows = await sqlJsDb.getAll(store);
            for (const row of rows) {
                const record = JSON.parse(row.data);
                await insertIntoNativeTable(nativeDb, store, record);
            }
            report.migrated[store] = rows.length;
        } catch (e) {
            report.errors.push({ store, error: String(e) });
        }
    }

    return report;
}
```

---

## 6. Riscos e Mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| **Tamanho do .db** — 3000 clientes + roteiros podem gerar arquivo grande para download em 3G | Média | Compressão gzip (`.db.gz`); transmissão chunked via HTTP Range; opção LAN/USB para campo |
| **Conflito de versão de schema** — desktop e mobile com versões diferentes do `schema_ddl.sql` | Alta | `schema_version` no `.meta.json`; validação na importação; migrations automáticas |
| **Plugin Capacitor SQLite** — dependência de plugin comunitário que pode quebrar em updates do Capacitor | Média | Plugin customizado com `android.database.sqlite` direto se necessário; interface `SqlitePort` abstrai o adapter |
| **Lock de arquivo** — SQLite não suporta múltiplos writers; mobile e sync service podem conflitar | Alta | WAL mode (já ativado no desktop); fila de operações serializada; retry com backoff |
| **Perda de dados na migração** — dados no IndexedDB podem ser perdidos se migração falhar | Alta | Rollback automático; backup do `sdb-snapshot` antes de migrar; validação de contagem |
| **Downgrade** — usuário que fez upgrade para APK novo precisa voltar para versão antiga | Baixa | Manter `IndexedDB` intacto até confirmação de sucesso por 7 dias; opção "Reverter para versão anterior" no menu |

---

## 7. Benefícios

| Benefício | Descrição |
|---|---|
| **Schema único** | `schema_ddl.sql` como fonte canônica — zero divergência desktop↔mobile |
| **Código compartilhado** | `Sqlite*Repository` roda idêntico em ambos — 50% menos código de acesso a dados |
| **Queries reais** | JOINs, índices compostos, subqueries — mobile ganha performance e expressividade |
| **Integridade referencial** | FK constraints nativas — sem dados órfãos no mobile |
| **Transações ACID** | Operações cross-table atômicas — sem estado intermediário corrompido |
| **Provisão instantânea** | Copiar `.db` binário → pronto. Sem pipeline de tradução JSON |
| **Debug único** | Mesmo tooling (DB Browser for SQLite, `sqlite3` CLI) para ambos |
| **Sem `json_extract`** | Fim das queries frágeis com JSON path — SQL puro e otimizável |

---

## 8. Alternativas Consideradas

### 8.1 Manter status quo (schema key-value no mobile)

**Rejeitada** — o custo de manutenção dos dois schemas escala linearmente com features novas. Já temos ~12 tabelas key-value e cada uma exige tradução manual de JSON ↔ colunas.

### 8.2 Usar sql.js WASM com schema completo (sem key-value)

**Rejeitada** — sql.js executa SQL completo, mas:
- Performance é pior que nativo (~3-5x mais lento)
- Limite de memória WASM (~2GB teórico, ~512MB prático)
- Carga inicial lenta (WASM binary + restore do IndexedDB)
- Sem integração com filesystem Android (backup, export)

### 8.3 Usar Supabase como único banco (mobile sem SQLite local)

**Rejeitada** — o sistema precisa funcionar offline em campo (premissa ADR-020). Mobile sem banco local = inútil sem internet.

---

## 9. Plano de Execução

| Fase | Descrição | Estimativa |
|---|---|---|
| **Fase 1: Adapter SQLite nativo** | Criar `CapacitorSqliteAdapter.ts` implementando `SqlitePort`; integrar plugin `@capacitor-community/sqlite` | 1 dia |
| **Fase 2: MobileDatabaseService** | Substituir `SyncEventDB.js` + `DataService` por `MobileDatabaseService` com schema real; portar queries de JSON → SQL | 2 dias |
| **Fase 3: Exportação desktop** | ✅ Parcial. Página e exportação implementadas. Pendente: gerar `.meta.json` e corrigir nomes de tabela com prefixo `tbl_` ausente no schema real | 0.5 dia (remanescente: 0.2 dia) |
| **Fase 4: Importação mobile** | Tela de provisionamento com import do `.db`, validação de schema, merge incremental | 1 dia |
| **Fase 5: Migração IndexedDB → SQLite** | Script de migração com extração, validação, rollback | 1 dia |
| **Fase 6: Testes** | Testes de integração desktop→mobile, sync pós-provisão, migração de dados, offline-first | 1 dia |
| **Fase 7: Limpeza** | Remover `sql.js` do `package.json`, remover `SyncEventDB.js`, `DataService`, `FormDataDB` IndexedDB | 0.5 dia |

**Estimativa total: ~7 dias**

---

## 10. Definição de Pronto (DoD)

- [ ] Mobile APK usa SQLite nativo (não sql.js WASM)
- [ ] Mobile e desktop executam o mesmo `schema_ddl.sql`
- [ ] Desktop exporta `.db` binário completo via `/admin/exportar-mobile`
- [ ] Mobile importa `.db` e inicia operação em < 30 segundos
- [ ] Sync incremental funciona após provisão (delta pós-exportação)
- [ ] Migração de dados IndexedDB → SQLite executada com sucesso em dispositivo de teste
- [ ] Operação offline mantida (sem dependência de internet após provisão)
- [ ] `sql.js` e `SyncEventDB.js` removidos do bundle mobile
- [ ] `IndexedDB` `FormDataDB` e `SyncEventDB` não são mais criados
- [ ] 0 regressões nos testes de sync (ADR-020, ADR-027)
- [ ] Documentação atualizada em `docs/Como-usar.md`
