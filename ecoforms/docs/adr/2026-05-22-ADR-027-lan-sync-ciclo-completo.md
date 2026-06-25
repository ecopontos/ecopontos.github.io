# ADR-027 — LAN Sync: Ciclo Completo (Push Multi-Domínio + Pull + Ingest + Provisão Mobile)

- **Status**: **Implementado** (LanPullService multi-domínio + tbl_lan_sync_cursors + wiring container)
- **Auditoria**: 2026-06-18
- **Data**: 2026-05-22
- **Autor**: Claude Code (auditoria de gaps no ciclo de sincronização LAN)
- **Decisor**: Pendente de aprovação
- **Ciclo de vida**: Proposto → Aceito → Implementado → Supersedido
- **Relacionados**: ADR-020 (LAN Sync Granular — base implementada), ADR-024 (Acesso Horizontal por Setor), ADR-026 (Task como Saída Universal), ADR-021 (LGPD — exclusão de dados sensíveis)

---

## Contexto

O ADR-020 definiu e implementou a infraestrutura de sincronização LAN:

- `LanFileStorage` — leitura/escrita de arquivos via Tauri (`lan_read_file`, `lan_write_file`, `lan_list_dir`)
- `LanDomainSyncService` — `syncEntity` (push com dedup por hash SHA-256), `pullIndex`, `fetchEntity`
- Estrutura de índice por domínio: `{lan_path}/{domain}/index.json` + `{lan_path}/{domain}/{entityId}.json`
- Configuração por estação: `tbl_configuracoes_sistema.lan_sync_path` com UI em `/admin/settings`

### Gap atual — dois lados incompletos

**Push parcial**: apenas o domínio `usuarios` é empurrado para a pasta LAN, acionado exclusivamente pelo `UserSnapshotService` quando um usuário é criado ou editado. Tarefas, demandas, agendamentos, manifestações e outros domínios operacionais nunca chegam à pasta LAN.

**Pull inexistente**: `LanDomainSyncService` expõe `pullIndex()` e `fetchEntity()` como métodos públicos, mas nenhum job, hook ou handler lê a pasta LAN de volta para atualizar o SQLite local. A pasta LAN é hoje um espelho de escrita sem consumidor.

Resultado: o canal LAN existe apenas como backup unidirecional de usuários. A premissa do ADR-020 — sincronização direta entre estações sem depender do Supabase — não está realizável com o código atual.

---

## Decisão

Completar o ciclo LAN em três frentes:

1. **Push multi-domínio** — estender o push para todos os domínios operacionais relevantes, acionado pelos use cases de mutação existentes.
2. **Pull periódico** — job que lê o `index.json` de cada domínio, detecta entidades novas ou alteradas e as ingere no SQLite local.
3. **Cursor de progresso** — tabela `tbl_lan_sync_cursors` que persiste o último `last_event_id` processado por domínio, tornando o pull incremental.

O pull **não passa pelo `HandlerRegistry`** (pipeline de eventos Supabase). Ele chama diretamente os repositórios de domínio — o snapshot JSON já é o estado final da entidade, não um evento de mutação.

---

## 1. Domínios cobertos

| Domínio | Tabela SQLite | Ponto de push | Direção |
|---------|--------------|---------------|---------|
| `usuarios` | `usuarios` | `UserSnapshotService` (já implementado) | push+pull |
| `tarefas` | `tarefas` | `TaskProjectionService` + `UpdateTaskUseCase` | push+pull |
| `demandas` | `tbl_demandas` | `CreateDemandaUseCase`, `AcceptDemandaUseCase`, `CloseDemandaUseCase` | push+pull |
| `agendamentos` | `tbl_agendamentos` | `ConfirmarAgendamentoUseCase`, `CancelarAgendamentoUseCase` | push+pull |
| `manifestacoes` | `tbl_manifestacoes` | `UpdateManifestacaoStatusUseCase` | push+pull |
| `setores` | `tbl_setores` | `CreateSetorUseCase`, `UpdateSetorUseCase` | push+pull |

Domínios excluídos do LAN sync: `tbl_audit_log` (segurança — não deve vazar entre estações), `sync_event_queue` (fila de transporte — local por definição), `anexos_cache`/`anexos_refs` (binários: LAN de arquivos é tratada separadamente via `OfflineStorageService`).

---

## 2. Estrutura de dados na pasta LAN

Sem alteração em relação ao ADR-020:

```
{lan_path}/
  usuarios/
    index.json                   ← { last_entity_uuid, entities: { id: { v, hash, last_event_id } } }
    {userId}.json                ← snapshot do usuário (sem hash_senha, sem sal_sync)
  tarefas/
    index.json
    {taskId}.json
  demandas/
    index.json
    {demandaId}.json
  agendamentos/
    index.json
    {agendamentoId}.json
  manifestacoes/
    index.json
    {manifestacaoId}.json
  setores/
    index.json
    {setorId}.json
```

---

## 3. Cursor de progresso — `tbl_lan_sync_cursors`

Nova tabela para rastrear até onde o pull processou em cada domínio:

```sql
CREATE TABLE IF NOT EXISTS tbl_lan_sync_cursors (
    domain          TEXT PRIMARY KEY,
    last_event_id   TEXT NOT NULL DEFAULT '',
    last_pulled_at  TEXT,
    pulled_count    INTEGER NOT NULL DEFAULT 0
);
```

Adicionada em `ensure-columns.ts` e `schema_consolidado_corrigido.sql`.

O pull é incremental: apenas entidades com `last_event_id > cursor.last_event_id` são processadas. Como `last_event_id` é um `uuidv7`, a comparação lexicográfica é monotônica por construção.

---

## 4. `LanPullService`

Novo serviço em `src/infrastructure/sync/LanPullService.ts`:

```typescript
export class LanPullService {
    constructor(
        private readonly lan:    LanDomainSyncService,
        private readonly sqlite: SqlitePort,
        private readonly repos:  LanIngestRepositories,
    ) {}

    async pullAll(): Promise<LanPullSummary> { ... }
    async pullDomain(domain: string): Promise<number> { ... }

    private async getCursor(domain: string): Promise<string> { ... }
    private async setCursor(domain: string, lastEventId: string, count: number): Promise<void> { ... }
}

export interface LanIngestRepositories {
    tarefas:       TaskRepository;
    demandas:      DemandaRepository;
    agendamentos:  AgendamentoRepository;
    manifestacoes: ManifestacaoRepository;
    setores:       SetorRepository;
    usuarios:      UserRepository;
}

export interface LanPullSummary {
    domains:      Record<string, number>;   // domain → entidades ingeridas
    totalIngested: number;
    durationMs:   number;
    errors:       string[];
}
```

### Algoritmo de pull por domínio

```
1. getCursor(domain)  → lastSeenEventId
2. lan.pullIndex(domain)  → index | null
3. se index null → return 0  (LAN não configurada ou domínio ausente)
4. para cada (entityId, entry) em index.entities:
     se entry.last_event_id <= lastSeenEventId → skip (já processado)
5. lan.fetchEntity(domain, entityId)  → snapshot | null
6. se snapshot null → skip (arquivo não encontrado — não é erro)
7. repos[domain].upsertFromSnapshot(snapshot)  → aplica no SQLite
8. setCursor(domain, max(last_event_id processados), count)
```

O pull é idempotente: reprocessar a mesma entidade com o mesmo hash não gera mutação (o `upsertFromSnapshot` usa `INSERT OR REPLACE` ou `ON CONFLICT DO UPDATE`).

---

## 5. Ponto de acionamento do pull

Dois gatilhos complementares:

**A. Ao focar a janela Tauri** — `EventSyncAdapter.onFocus()` já chama `sync()` para o canal Supabase. Adicionar `lanPull.pullAll()` no mesmo handler, antes do sync Supabase. Latência aceitável: o pull LAN é local (filesystem), mais rápido que rede.

**B. Intervalo periódico** — mesmo scheduler de `SyncContext` que controla o intervalo de auto-sync. Pull LAN roda junto com o cycle Supabase. Sem intervalo independente para evitar dois timers concorrentes.

O pull LAN roda **antes** do sync Supabase em ambos os casos: dados locais de rede são ingeridos primeiro, depois o push para nuvem já inclui o estado mais recente.

---

## 6. Push — integração nos use cases

Cada use case de mutação relevante recebe `LanDomainSyncService` como dependência opcional e chama `syncEntity` após persistir no SQLite:

```typescript
// Padrão adotado — idêntico ao que UserSnapshotService já faz:

async execute(input: CreateDemandaInput): Promise<DemandaDto> {
    const demanda = ...;
    await this.repo.save(demanda);

    const snapshot = toDemandaSnapshot(demanda);
    await this.lanSync?.syncEntity('demandas', demanda.id, snapshot).catch(e =>
        console.warn('[LAN] push demanda falhou', e)
    );

    return toDemandaDto(demanda);
}
```

`LanDomainSyncService` é sempre opcional nos construtores — `lanSync?.syncEntity(...)` garante que a ausência de configuração LAN não afeta o fluxo principal. Falhas de push LAN são `console.warn`, nunca lançadas.

---

## 7. Snapshots — contratos de serialização

Cada domínio define uma função `to{Domain}Snapshot()` que produz o objeto JSON gravado na pasta LAN. O snapshot deve ser **autocontido** — suficiente para reconstruir a entidade no repositório destino sem consultas adicionais.

Restrições de segurança:
- `usuarios`: `hash_senha` e `sal_sync` **nunca** presentes (já garantido pelo `UserSnapshotService`)
- Demais domínios: sem restrições adicionais além das já aplicadas pelo `toDto()` correspondente

---

## 8. Resolução de conflitos

Conflito ocorre quando duas estações editam a mesma entidade antes de sincronizar. A política é **LWW (Last Write Wins) por `last_event_id`**: o snapshot com `last_event_id` maior vence, por ser o mais recente (uuidv7 é monotônico por construção).

O `LanDomainSyncService.updateIndex()` já implementa essa lógica:
```typescript
if (existing && existing.last_event_id >= lastEventId) return; // ignora se não for mais recente
```

No pull, o cursor garante que entidades já processadas não são reprocessadas. Em caso de conflito detectado no `upsertFromSnapshot` (entidade mais antiga chegando depois), o `atualizado_em` do snapshot é comparado com o registro local — o mais recente vence.

---

## 9. Provisão Mobile — Configuração Inicial sem Tráfego Web

### Contexto específico

O app mobile (Capacitor + Android) usa **sql.js** (SQLite compilado em WASM) como banco de dados em memória. O sql.js persiste seu estado como um blob binário no IndexedDB sob a chave `sdb-snapshot`. Ao iniciar, `SyncEventDB.openSyncEventDB()` restaura esse blob e reconstrói o banco.

O schema das tabelas no mobile é uniforme e diferente do desktop:
```sql
CREATE TABLE IF NOT EXISTS [tbl_clientes] (id TEXT PRIMARY KEY, data TEXT NOT NULL)
-- data = JSON.stringify(registro_completo)
```

Para deployments com grandes volumes de dados de referência (ex: 3 000 clientes, roteiros, ecopontos), sincronizar esses dados via Supabase Storage no primeiro uso é lento, caro em banda e expõe dados desnecessariamente à nuvem. A provisão local resolve isso: o desktop gera um arquivo binário `.db` com o sql.js snapshot e entrega ao mobile via pasta LAN ou cabo USB.

### Decisão

O desktop gera um **arquivo SQLite binário** com o schema mobile (`id, data`) populado a partir do SQLite local. O arquivo é depositado na pasta LAN configurada (mesma infraestrutura do ADR-027) sob o caminho `mobile/provision_YYYY-MM-DD.db`. O mobile importa o arquivo através de uma tela dedicada de configuração inicial, que escreve o blob no IndexedDB como `sdb-snapshot`.

### 9.1 Formato do arquivo de provisão

O arquivo é um SQLite válido (compatível com sql.js) contendo as tabelas do mobile populadas:

```
mobile/
  provision_2026-05-22.db     ← arquivo binário, gerado pelo desktop
  provision_2026-05-22.meta   ← JSON: { geradoEm, geradoPor, stores: { nome: contagem } }
```

### 9.2 Mapeamento desktop → stores mobile

| Store mobile | Fonte desktop | SQL de extração | Restrições |
|---|---|---|---|
| `usuarios` | `usuarios` | `SELECT id, nome, nome_usuario, email, perfil, ativo, setor_principal_id, criado_em FROM usuarios` | sem `hash_senha`, sem `sal_sync` |
| `tbl_clientes` | `clientes` | `SELECT * FROM clientes` | `ativo = 1` |
| `data_registry` | `data_registry` | `SELECT * FROM data_registry` | completo |
| `tbl_roteiros` | `roteiros` + `roteiro_clientes` | roteiro com array `clientes` embedded via subquery JSON | `ativo = 1` |
| `tbl_ecopontos` | `ecopontos` | `SELECT * FROM ecopontos` | `ativo = 1` |
| `tbl_modulos` | `tbl_module_registry` | `SELECT * FROM tbl_module_registry` | `publicado = 1` |
| `tarefas` | `tarefas` | `SELECT * FROM tarefas` | `arquivado = 0` |
| `tbl_demandas` | `tbl_demandas` | `SELECT * FROM tbl_demandas` | status não encerrado |
| `suite` | `tbl_suite` | `SELECT * FROM tbl_suite` | status ativo |

Para cada store, cada registro do desktop é inserido no arquivo de provisão como:
```sql
INSERT INTO [tbl_clientes] (id, data) VALUES (?, ?)
-- id  = registro.id
-- data = JSON.stringify(registro)
```

O campo `id` é derivado por `_deriveKey()` do SyncEventDB — para a maioria dos domínios é simplesmente `registro.id`. Para `data_registry` é `${tipo}_${chave}`.

### 9.3 Geração do arquivo — Tauri command `generate_mobile_provision`

A geração ocorre no lado Rust porque o desktop já tem SQLite nativo via `database.rs`. Um novo command:

```rust
// src-tauri/src/commands/mobile_provision.rs

#[tauri::command]
pub async fn generate_mobile_provision(
    state: tauri::State<'_, AppState>,
    output_path: String,
) -> Result<MobileProvisionMeta, String>
```

Fluxo interno:
1. Abre o SQLite principal (leitura)
2. Cria um novo arquivo SQLite temporário no caminho `output_path`
3. Para cada store do mapeamento: cria tabela `(id TEXT PRIMARY KEY, data TEXT NOT NULL)`, executa a query de extração, insere com `JSON_OBJECT(...)` ou via serialização row → JSON
4. Fecha o arquivo temporário
5. Retorna `MobileProvisionMeta { geradoEm, geradoPor, stores: { nome: count } }`

Se `lan_sync_path` estiver configurado, o command também copia o arquivo para `{lan_sync_path}/mobile/provision_{date}.db`.

### 9.4 UI de geração — `/admin/settings` (painel LAN)

Na seção "Sincronização LAN" existente, adicionar um card "Provisão Mobile":

```
┌─ Provisão Mobile ──────────────────────────────────────────────┐
│  Gera um arquivo de banco de dados para instalação inicial do  │
│  app mobile sem depender de conexão com a internet.            │
│                                                                │
│  Última geração: 22/05/2026 às 14:30 — 3.247 registros        │
│                                                                │
│  [Gerar e salvar na pasta LAN]   [Baixar arquivo .db]          │
└────────────────────────────────────────────────────────────────┘
```

Dois modos:
- **Salvar na pasta LAN**: chama `generate_mobile_provision` com `output_path = {lan_path}/mobile/provision_{date}.db`
- **Baixar arquivo**: gera em temp dir e dispara download do arquivo binário via `convertFileSrc` ou `readFile` + Blob

### 9.5 Import no mobile — tela de configuração inicial

Nova tela no mobile `www/configuracao-inicial.html` (ou rota dentro do app):

```
┌─ Configuração Inicial ─────────────────────────────────────────┐
│                                                                │
│  Importe o arquivo de provisão gerado pelo desktop para        │
│  popular os dados locais sem precisar de internet.             │
│                                                                │
│  [Selecionar arquivo .db]                                      │
│                                                                │
│  ✓ 3.247 registros importados                                  │
│    usuarios: 12  ·  clientes: 2.891  ·  roteiros: 8  ...       │
│                                                                │
│  [Concluir e abrir o app]                                      │
└────────────────────────────────────────────────────────────────┘
```

Fluxo de import no mobile (`www/js/sync/MobileProvision.js`):

```javascript
export async function importProvisionFile(file) {
    // 1. Lê o arquivo como ArrayBuffer
    const buffer = await file.arrayBuffer();
    const data = new Uint8Array(buffer);

    // 2. Valida que é um SQLite válido (magic bytes: 53 51 4c 69 74 65)
    const magic = String.fromCharCode(...data.slice(0, 6));
    if (magic !== 'SQLite') throw new Error('Arquivo inválido');

    // 3. Escreve diretamente no IndexedDB como sdb-snapshot
    const idb = await _openIndexedDB();
    const tx = idb.transaction('snapshots', 'readwrite');
    tx.objectStore('snapshots').put(data.buffer, 'sdb-snapshot');
    await txComplete(tx);

    // 4. Abre o banco para verificar e retornar contagens
    const db = await openSyncEventDB();
    return await _countStores(db);
}
```

A escrita direta do buffer no IndexedDB como `sdb-snapshot` é compatível com o mecanismo existente de `_restoreFromIndexedDB` — na próxima chamada a `openSyncEventDB()` o banco é restaurado com todos os dados.

### 9.6 Segurança

- `hash_senha` e `sal_sync` **nunca** incluídos (constraint no SQL de extração do `usuarios`)
- O arquivo `.db` não é cifrado — deve ser tratado como dado sensível pelo operador (acesso físico controlado, igual ao SQLite do desktop)
- Dados de audit log (`tbl_audit_log`) **nunca** incluídos
- O arquivo não inclui `sync_event_queue` nem `tbl_lan_sync_cursors`

---

## Plano de Execução

### Fase 1 — Schema (30min)

```
├── ensure-columns.ts: CREATE TABLE tbl_lan_sync_cursors
└── schema_consolidado_corrigido.sql: espelhar tabela
```

### Fase 2 — `LanPullService` (3h)

```
├── src/infrastructure/sync/LanPullService.ts: implementação completa
├── Cada repositório ganha upsertFromSnapshot(snapshot): aplicação idempotente
├── container.ts: instanciar LanPullService com todos os repos
└── Teste unitário: pullDomain processa apenas entidades novas (cursor respeitado)
```

### Fase 3 — Push multi-domínio (2h)

```
├── CreateDemandaUseCase, AcceptDemandaUseCase, CloseDemandaUseCase: + lanSync?.syncEntity
├── TaskProjectionService, UpdateTaskUseCase: + lanSync?.syncEntity
├── ConfirmarAgendamentoUseCase, CancelarAgendamentoUseCase: + lanSync?.syncEntity
├── UpdateManifestacaoStatusUseCase: + lanSync?.syncEntity
└── CreateSetorUseCase, UpdateSetorUseCase: + lanSync?.syncEntity
```

### Fase 4 — Integração no ciclo de sync (1h)

```
├── EventSyncAdapter: chamar lanPull.pullAll() antes de sync Supabase
├── SyncContext: expor stats do pull LAN no estado de sync
└── /admin/settings LanSyncSection: exibir último pull (timestamp + entidades ingeridas)
```

### Fase 5 — Smoke test multi-estação (1h)

```
├── Estação A cria tarefa → arquivo aparece em pasta LAN
├── Estação B (lan_sync_path apontando para mesma pasta) → tarefa aparece no SQLite local
└── Conflito: ambas editam mesma tarefa → LWW resolve para a mais recente
```

### Fase 6 — Provisão Mobile (3h)

```
Desktop:
├── src-tauri/src/commands/mobile_provision.rs: command generate_mobile_provision
│     ├── Cria SQLite temporário com schema mobile (id, data)
│     ├── Executa queries de extração por store (mapeamento seção 9.2)
│     ├── Serializa cada row como JSON no campo data
│     └── Copia para {lan_path}/mobile/provision_{date}.db se configurado
├── src-tauri/src/lib.rs: registrar novo command
└── /admin/settings LanSyncSection: card "Provisão Mobile"
      ├── Botão "Gerar e salvar na pasta LAN"
      └── Botão "Baixar arquivo .db"

Mobile:
├── www/js/sync/MobileProvision.js: importProvisionFile(file)
│     ├── Valida magic bytes SQLite
│     ├── Escreve buffer como sdb-snapshot no IndexedDB
│     └── Retorna contagens por store
└── www/configuracao-inicial.html (ou rota): tela de import com file picker
```

**Estimativa total: ~2 dias** (1,5 dias LAN desktop + 3h provisão mobile)

---

## O que NÃO muda

- `LanFileStorage` — sem alterações
- `LanDomainSyncService` — sem alterações (API já completa)
- `UserSnapshotService` — passa a ser um caller do padrão geral, sem refatoração
- Estrutura de arquivos na pasta LAN — inalterada
- Canal Supabase Storage — independente; LAN e Supabase coexistem sem conflito
- Configuração por estação — `lan_sync_path` continua sendo a chave única

---

## Consequências

### Positivas

- Sincronização entre estações funciona sem internet — premissa original do ADR-020 realizada
- Pull é incremental e idempotente — seguro para rodar múltiplas vezes sem efeitos colaterais
- Push é fire-and-forget — falhas LAN nunca bloqueiam o fluxo operacional principal
- Conflitos resolvidos automaticamente por LWW com uuidv7 — sem interação do usuário

### Negativas / Custos

- Cada use case de mutação ganha uma dependência opcional a mais (`LanDomainSyncService`)
- `upsertFromSnapshot` precisa ser adicionado a cada repositório — trabalho repetitivo mas mecânico
- Dois caminhos de ingest (LAN direto via repositório vs Supabase via HandlerRegistry) — risco de divergência se um dos dois tiver lógica extra (hooks, side effects)

### Riscos

- **Push antes do pull**: se uma estação escreve na pasta LAN e a estação destino nunca lê antes de também escrever, a entidade mais antiga pode sobrescrever a mais nova no índice. Mitigação: pull sempre roda antes do push no ciclo de sync.
- **Pasta LAN com permissão parcial**: `LanFileStorage.testConnection()` verifica acesso mas não valida permissões de escrita em subpastas criadas dinamicamente. Mitigação: criar estrutura de pastas no primeiro `syncEntity` e capturar erros de permissão explicitamente.
- **Snapshot de domínio incompleto**: se `to{Domain}Snapshot()` omitir um campo, o `upsertFromSnapshot` no destino grava um registro parcial. Mitigação: usar o mesmo DTO que o `toDto()` existente como base; adicionar testes de round-trip (snapshot → upsert → toDto → comparar).

---

## Critérios de Aceitação

1. Estação A cria uma tarefa → arquivo `tarefas/{id}.json` aparece na pasta LAN
2. Estação B (com mesma `lan_sync_path`) → pull ingere a tarefa no SQLite local sem interação manual
3. `tbl_lan_sync_cursors` tem registro por domínio após o primeiro pull
4. Segundo pull com mesma pasta → zero entidades re-processadas (cursor respeitado)
5. Pull com `lan_sync_path` vazio → `pullAll()` retorna `{ totalIngested: 0 }` sem erro
6. Falha de escrita na pasta LAN → use case principal completa normalmente; `console.warn` emitido
7. Conflito LWW: snapshot com `last_event_id` menor chegando depois → descartado no `updateIndex`
8. `usuarios` continua sendo sincronizado (sem regressão do ADR-020)
9. `hash_senha` e `sal_sync` ausentes em todos os snapshots de `usuarios` na pasta LAN
10. `/admin/settings` exibe timestamp e contagem do último pull LAN

**Provisão Mobile:**

11. `generate_mobile_provision` gera arquivo `.db` válido (magic bytes SQLite presentes)
12. Arquivo gerado contém todas as stores do mapeamento com dados populados
13. `hash_senha`, `sal_sync` e `tbl_audit_log` ausentes do arquivo gerado
14. Mobile importa o arquivo → `openSyncEventDB()` subsequente restaura todos os stores
15. Contagens no mobile após import batem com as contagens exibidas na UI de geração
16. Segundo import com arquivo mais recente sobrescreve o anterior (idempotente)
17. Arquivo com magic bytes inválidos → `importProvisionFile` lança erro antes de escrever no IndexedDB
18. Geração com `lan_sync_path` configurado → arquivo aparece em `{lan_path}/mobile/provision_{date}.db`
