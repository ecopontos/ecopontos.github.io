# ADR-056 — Fonte de Verdade dos Dados

- **Status:**Decidido** (implementação majoritariamente concluída — 2 pendências menores em aberto, ver §6.atualizado)
- **Data:** 2026-06-11
- **Atualizado:** 2026-06-18 (triagem de ADRs — auditoria de status por item V*)
- **Contexto da decisão:** mapeamento de backend (achados 1–7) + validação contra o código vivo

> Este documento é o **baseline corrigido** a ser entregue a qualquer análise externa
> (ex.: DeepSeek). O mapa original misturava três eras do projeto; aqui o que é código
> vivo está separado do que é legado morto. **Decida sobre o vivo, não sobre o fantasma.**

---

## 1. Correções ao mapa de origem (validadas no código)

Antes da decisão, três afirmações do mapa precisam ser ajustadas — senão a arquitetura
seria desenhada em torno de código que não roda em produção.

| Afirmação do mapa | Veredito | Evidência |
|---|---|---|
| "Dois SQLites: rusqlite **+ OPFS browser** no desktop" | **FALSO (vivo)** | Todos os hits de OPFS no `desktop/` são comentários de limpeza de caminho legado (`remover prefixo opfs:// se existir (legado)`). Desktop tem **um** SQLite (rusqlite via Tauri invoke). |
| "Sync snapshot-based `js/sqlite-supabase-sync-service.js` competindo no bucket" | **LEGADO MORTO** | Vive na pasta raiz `js/`, fora dos workspaces (`desktop/`, `mobile/`, `packages/core`). Só é referenciada por `mobile_standalone/` (outro legado). É o app vanilla-JS pré-monorepo. |
| "Cadeia Browser: SQLite Worker → SQLite Direct → Supabase" | **LEGADO MORTO** | `js/sqlite-config.js` / `js/sqlite-worker-adapter.js` — mesma pasta legada. |
| "Triple write em `OfflineStorageService.saveFile()`" | **REAL, mas fora de escopo** | É backup de **anexo binário** (fotos): AppData (obrigatório) + UNC de rede (opcional). Não é verdade de *dados de domínio*. Pode permanecer. |

**Pré-requisito de higiene (ação separada, antes da migração):**
deletar/quarentenar `js/` e `mobile_standalone/`. Removem ~metade da aparente "competição
entre camadas" sem custo arquitetural.

**Resolvido — commit `455e8b3`.** `js/` (19 arquivos) + `mobile_standalone/` (452 arquivos) removidos do tracking.
Nenhum código vivo (`desktop/src`, `mobile/www`, `packages/core`) importava desses diretórios.
Entradas adicionadas ao `.gitignore`.

---

## 2. O que é código vivo (a topologia real)

Origem de escrita por dispositivo:
- **Desktop:** SQLite nativo (rusqlite via `invoke('db_execute')`).
- **Mobile:** IndexedDB (`SyncEventDB`).

Convergência entre dispositivos — **dois mecanismos coexistem hoje:**

### Mecanismo A — Log de eventos (transacional, bidirecional)
- `sync_event_queue` (SQLite/IndexedDB) → `TransportService` criptografa → `orgs/.../eventos/evt_*.enc` no Supabase Storage + espelho LAN.
- `InboundService` puxa, confere manifest, aplica via `HandlerRegistry`.
- Conflitos: `ConflictResolver` (LWW + hash) — **já implementado** em `packages/core/sync`.
- Cobre: formulários/suites, tarefas, demandas, manifestações, audit.

### Mecanismo B — Snapshots de estado (referência, **unidirecional**)
- Desktop é **autoridade única**. Publica estado atual como JSON:
  - `UserSnapshotService.publishUserSnapshot()` → `shared/users.json` (a cada mutação de usuário).
  - `CrmSnapshotPublisher.publishAll()` → catálogos CRM (no boot).
  - `shared/ecoponto_caixas.json`, `shared/data_registry.json`, `shared/tasks.json`, etc.
- **Mobile consome read-only** (`auth-manager.js`, `dashboard-service.js`). **Não há write-back.**
- Cobre: identidade (usuários), catálogos/dados de referência, leitura de dashboard no mobile.

> Conclusão-chave: B **não compete** com A pela mesma escrita. B é uma **projeção
> unidirecional** desktop → mobile-leitor. O risco real é apenas **sobreposição**: dados
> que viajam por A *e* por B ao mesmo tempo (ver §4).

---

## 3. Decisão

Adotar uma **fonte de verdade em duas camadas (tiers)**, explícita e enforçada:

### Tier A — Dados transacionais → **Log de eventos é canônico**
- O event log (`sync_event_queue` → `.enc`) é a fonte de verdade inter-dispositivo.
- SQLite/IndexedDB são **projeções** do log aplicado, não autoridades independentes.
- LWW+hash (`ConflictResolver`) é a política única de resolução.
- **Nenhuma escrita de dado transacional pode existir fora do log.**

### Tier B — Dados de referência/identidade → **Desktop SQLite é autoridade única**
- Distribuído por snapshot **unidirecional**, **somente leitura** para consumidores (mobile).
- Snapshots são **derivação**, nunca caminho de write-back.
- Já é de fato assim; a decisão apenas **torna explícito e proíbe regressão** (nenhum
  consumidor pode escrever de volta em `shared/*.json`).

### Transporte ≠ Verdade
- **LAN e Supabase Storage são dois transportes do mesmo conteúdo**, não duas verdades.
- Espelhar em ambos é aceitável **se e somente se** a escrita for determinística e
  idempotente (mesmo evento/snapshot → mesmo byte). Caso contrário, eleger Supabase como
  canônico e LAN como cache opportunista.

---

## 4. Write-paths que VIOLAM a decisão (a corrigir)

> Esta é a lista de trabalho. Cada item é uma escrita que precisa virar projeção,
> ser removida, ou ter sua sobreposição resolvida. **Preencher/validar com o mapeamento.**

| # | Local | Violação | Ação proposta |
|---|---|---|---|
| V1 | `UserSnapshotService` + event log | Usuário viaja por snapshot **e** (verificar) por evento de usuário? | Definir: usuário é **Tier B puro** (só snapshot). Remover qualquer evento de usuário concorrente. |
| V2 | `CrmSnapshotPublisher` | Catálogos CRM publicados como snapshot — há também escrita via evento? | Confirmar Tier B; garantir publisher = projeção de SQLite, sem lógica própria. |
| V3a | `shared/data_registry.json` | `data_registry` é Tier A (evento `ecoforms.registro.criado` → `registro_dados`) **e** Tier B (mobile lê `shared/data_registry.json`). Sobreposição A∩B, **lado mobile read-only**. | **Resolvido (baixo risco):** `data_registry` = Tier A canônico. O `shared/data_registry.json` vira **cache derivado** da tabela `registro_dados`, regenerado, nunca autoritativo. Escritor de runtime não localizado (só script `force_push_registry.js`) — confirmar e formalizar publisher como projeção. |
| V3b | `tasks` (3 caminhos) | `task.criada/concluida` → tabela `tarefas` (Tier A) **+** `shared/tasks.json` lido pelo mobile (Tier B leitura) **+** write-back do mobile fora do log (ver V7). | **Implementado:** unificado em Tier A. `ActivityService.js` (4 métodos: `startTask`, `completeTask`, `startActivity`, `completeActivity`) migrados de `dataService.sendTaskStatusUpdate()` / `uploadTaskUpdateSnapshot()` (V7) para `window.syncAdapter.publishEvent('task.atualizada'/'task.concluida', ...)`. Novo tipo de evento `task.atualizada` adicionado a `EventEnvelope.ts` + `ecoforms-core.js`. Handlers registrados no desktop (`HandlerRegistry.ts`) e mobile (`HandlerRegistry.js`). `shared/tasks.json` permanece cache derivado read-only. |
| V4 | `TransportService` / `StorageBootstrapService` | Escrita Supabase **+** LAN sem canônico definido. | **Resolvido — Supabase eleito canônico, LAN = cache opportunista.** Verificação de idempotência: AES-GCM usa `crypto.getRandomValues(new Uint8Array(12))` como nonce — **não determinístico**. Mesmo dado + mesma chave = ciphertext diferente. Condição "mesmo evento/snapshot → mesmo byte" **não atendida** para o log de eventos (Tier A). Para snapshots (Tier B), `LanDomainSyncService` já tem hash-based skip (SHA-256) — idempotente. Conclusão: Supabase é a fonte canônica; espelhamento LAN é best-effort, sem garantia de byte-identical. |
| V5 | Duplicação TS↔JS (`TransportService.ts` ⇄ `www/js/sync/TransportService.js`) | Mesma lógica em dois lugares; bug-fix em dobro. | **Implementado.** Criado `packages/core/src/sync/TransportCore.ts` com funções compartilhadas: `buildEventPath()`, `uploadEventWithRetry()`, constantes `TRANSPORT_BATCH_SIZE` / `TRANSPORT_MAX_RETRIES`. Desktop (`TransportService.ts`) importa via `ecoforms-core`. Mobile (`TransportService.js`) importa via `/js/ecoforms-core.js`. `_uploadWithRetry` inline removido de ambos (40 linhas duplicadas eliminadas). `packages/core` rebuild com `tsc`. |
| V6 | Sem orquestrador / fallback por serviço (achados 3,4,7) | Cada serviço decide quando escrever, onde ler, qual fallback. | Um ponto único de decisão de transporte (porta `SyncTransportPort`) que serializa A e B sobre o mesmo bucket. |
| **V7** | **Write-back de tarefa não testado (mobile→desktop)** | Mobile escreve status em `shared/inbox/{task_update,task_status}_*.json` de 3 serviços (`ActivityService.js`, `data-service.js`, `FormSyncService.js`), esperando upsert no desktop. **Mas o único leitor de inbox no desktop** (`useKanbanMutations.ts → unfreezeTask`) lê outro path: `users/{userId}/inbox/{taskId}/patches/`. Nenhum runtime do desktop consome `shared/inbox/task_*`. | **Implementado.** `sendTaskStatusUpdate()` em `data-service.js` e `FormSyncService.js` marcados `@deprecated`. `uploadTaskUpdateSnapshot()` em `ActivityService.js` marcado `@deprecated`. Nenhum caller restante — todos os 4 métodos de status em `ActivityService.js` migrados para `window.syncAdapter.publishEvent()` (V3b). |
| **V8** | **Mecanismo A do mobile é inoperante sob a RLS ativa** | `window.globalSupabaseClient` é criado com a chave **anon** (`mobile/www/supabase-config.js:11` + `data-service.js:84-86`). A RLS ativa (`04-rls-v3-anon-shared-only.sql`) só concede `anon_read_shared` (SELECT em `shared/%`). `TransportService.pushPending()` (upload em `orgs/.../eventos/...`), `Manifest.update()` (escrita em `shared/manifests/...`) e `InboundService.pull()` (download em `orgs/.../eventos/...`) são **todos rejeitados** — anon não tem INSERT/UPDATE em lugar nenhum, nem SELECT fora de `shared/%`. | **Mesmo padrão de V7: nunca validado fim-a-fim.** O Mecanismo A do mobile está de fato desligado desde que a v3 foi aplicada (ou desde sempre). Resolvido pela proposta da §8 — `sync_event_index` substitui o manifest e o transporte `.enc` por RPCs `SECURITY DEFINER`, eliminando a dependência de Storage RLS para `anon`. |

---

## 5. Consequências

**Positivas**
- Uma regra clara: "é transacional? → log. É referência? → SQLite desktop + snapshot read-only."
- Aproveita 100% do aparato já construído (envelope v2, manifests, LWW+hash, core).
- Mobile não muda de papel (já é read-only) → migração de baixo risco.
- Deletar `js/`/`mobile_standalone/` reduz superfície e ruído de análise.

**Custos / riscos**
- ~~Resolver a sobreposição A∩B (V3) exige decisão dado-a-dado~~ — resolvido para tasks (V3b) e data_registry (V3a).
- ~~Idempotência do espelho LAN/Supabase (V4) precisa ser provada~~ — analisado. AES-GCM não determinístico. Supabase = canônico, LAN = opportunista.
- ~~Consolidação TS↔JS (V5) é refatoração com testes de paridade~~ — implementado. `TransportCore.ts` em `packages/core/sync`. Desktop + mobile importam do core.
- ~~§8 (sync_event_index) pendente~~ — implementado. `Manifest`/transporte `.enc` substituídos por `sync_event_index` + RPCs.
- V1 (UserSnapshotService), V2 (CrmSnapshotPublisher) pendentes. V6 (SyncTransportPort) implementado.

---

## 6. Pendências antes de cravar (status: MAJORITARIAMENTE RESOLVIDO)

- [x] **V3 — sobreposição A∩B:** investigado e implementado.
      - `data_registry` (V3a): Tier A (evento → `registro_dados`) + Tier B read-only no mobile. Baixo risco.
      - `tasks` (V3b): Tier A (`tarefas`) + leitura `shared/tasks.json` + **write-back substituído por evento** (V7). `task.atualizada` adicionado ao event log.
- [x] **V7 — write-back não testado:** métodos `sendTaskStatusUpdate()` (data-service.js, FormSyncService.js) e `uploadTaskUpdateSnapshot()` (ActivityService.js) marcados `@deprecated`. Sem callers restantes.
- [x] **V8 — mobile (anon) vs RLS v3:** confirmado. `globalSupabaseClient` do mobile usa a chave anon; RLS v3 não concede write algum a anon e não cobre `orgs/%/eventos/%` para leitura. Mecanismo A do mobile está inoperante. Resolvido pela proposta da §8.
- [x] **V4 — idempotência:** verificado. AES-GCM com nonce aleatório → não determinístico. Supabase = canônico, LAN = cache opportunista.
- [x] **Higiene:** `js/` (19 arquivos) e `mobile_standalone/` (452 arquivos) removidos do tracking (commit `455e8b3`). `.gitignore` atualizado.
- [x] **V5 — Duplicação TS↔JS:** consolidado. `TransportCore.ts` em `packages/core/sync`. Desktop + mobile importam do core. `_uploadWithRetry` inline removido de ambos.
- [x] **§8 — `sync_event_index`:** implementado. Migração `05-sync-event-index.sql` (tabela + `rpc_push_sync_event` + `rpc_pull_sync_events`, `SECURITY DEFINER`, sem RLS por `org_id` — acesso somente via RPC) aplicada e verificada (`verify-sync-event-index.ts` PASS, roundtrip `BYTEA`/hex). `packages/core/src/sync/SyncEventIndexCore.ts` (novo: `bytesToPgHex`/`pgHexToBytes`/`createSupabaseSyncEventIndex`/`pushEventToIndex`). Desktop: `TransportService.ts`/`InboundService.ts`/`lazy-sync.ts` reescritos para usar `index.pushEvent`/`index.pullEvents`; `Manifest.ts` removido. Mobile: `TransportService.js`/`InboundService.js`/`SyncAdapter.js` reescritos no mesmo padrão; `Manifest.js` removido; `log_gaps_sync` adicionado a `MobileSchemaBootstrap.js` (paridade com `ensure-columns.ts`). `sync-protocol.test.ts` reescrito com `FakeSyncEventIndex` — 21/21 passando.
- [ ] **V1 — UserSnapshotService + event log:** pendente. Definir se usuário é Tier B puro.
- [ ] **V2 — CrmSnapshotPublisher:** pendente. Confirmar Tier B, sem lógica própria.
- [x] **V6 — SyncTransportPort:** implementado (2026-06-15). Porta `SyncTransportPort` em `packages/core/src/sync/SyncTransportPort.ts`. Config compartilhada `DEFAULT_TRANSPORT_CONFIG` (rate limit, circuit breaker, gap retry) em `TransportCore.ts`. Telemetria `TransportMetrics` em `TransportMetrics.ts`. Orquestrador `SyncTransportService` no desktop (wrappa `TransportService` + `InboundService` + circuit breaker exponential backoff + gap management). Exposto via `getSyncTransportService()` em `lazy-sync.ts` + `container.ts`. 29/29 sync tests passando.
- [x] Numeração ADR-056 livre (topo atual = ADR-055).

### 6.1 Auditoria de status (2026-06-18 — triagem de ADRs)

> Verificação contra o código vivo. **Nota sobre o working tree:** os artefatos V6 (`SyncTransportPort.ts`) e F4 (`payloadSchemas.ts`) existem no disco mas estão **não-rastreados** (`??` no `git status`) — implementados mas ainda não commitados.

| Item | Status verificado | Evidência |
|---|---|---|
| V3 (A∩B sobreposição) | ✅ Resolvido | `task.atualizada` em `EventEnvelope.ts`; handlers registrados em `HandlerRegistry.ts` (desktop) e `.js` (mobile). |
| V4 (idempotência) | ✅ Resolvido | AES-GCM não-determinístico confirmado; Supabase = canônico, LAN = opportunista. |
| V5 (duplicação TS↔JS) | ✅ Resolvido | `packages/core/src/sync/TransportCore.ts` rastreado. |
| V7 (write-back mobile) | ✅ Resolvido | Métodos `@deprecated`, sem callers. |
| V8 (mobile anon vs RLS) | ✅ Resolvido | `sync_event_index` via RPCs `SECURITY DEFINER`. |
| §8 (`sync_event_index`) | ✅ Implementado | `desktop/supabase/migrations/05-sync-event-index.sql` rastreado. `SyncEventIndexCore.ts` em `packages/core/sync`. |
| Higiene (`js/`, `mobile_standalone/`) | ✅ Resolvido | Fora do tracking (commit `455e8b3`). |
| **V1 (UserSnapshotService + event log)** | 🔴 **Pendente** | `UserSnapshotService.ts` existe; decisão se usuário é Tier B puro **não formalizada**. |
| **V2 (CrmSnapshotPublisher)** | 🔴 **Pendente** | `CrmSnapshotPublisher.ts` existe; confirmação Tier B sem lógica própria **não feita**. |
| **V6 (SyncTransportPort)** | 🟡 **Implementado, não commitado** | Arquivo `packages/core/src/sync/SyncTransportPort.ts` existe no disco mas está **não-rastreado** (`??`). `TransportMetrics.ts` e `SyncTransportService` idem. Commitar antes de depender disso em produção. |

**Conclusão da auditoria:** 7 de 9 itens resolvidos e commitados; 2 pendentes (V1, V2 — formalização menor, não bloqueadores); 1 implementado mas não-commitado (V6). Decisão Tier A/B **continua vigente** e não conflita com ADR-064 (que opera na camada de transporte/projeções acima desta decisão de fonte de verdade).

> **Colisão de numeração observada:** existe outro `ADR-056-mobile-sync-pipeline.md` (restaurado de `desktop/docs/adr/` em 2026-06-18) — documento distinto sobre o pipeline de sincronização mobile. Este ADR-056 (Fonte de Verdade) é o canônico para a decisão de tiers de dados.

---

## 7. Anexo — evidências de código

- Mobile read-only: `mobile/www/js/auth-manager.js:1239-1294`, `mobile/www/js/dashboard-service.js:1392-1693`.
- Desktop autoridade snapshot: `desktop/src/infrastructure/sync/UserSnapshotService.ts:51,107`,
  `desktop/src/infrastructure/sync/CrmSnapshotPublisher.ts:11`, `desktop/src/infrastructure/container.ts:382,417`.
- Log de eventos: `TransportService.ts`, `InboundService.ts`, `packages/core/sync` (`EventEnvelope`, `ConflictResolver`).
- Legado morto: raiz `js/*.js` (14 arquivos), `mobile_standalone/`.
- OPFS = legado: `desktop/src/infrastructure/storage/OfflineStorageService.ts:91-109`, `desktop/lib/offline-storage.ts:88-106`.
- V8 — cliente mobile: `mobile/www/js/sync/SupabaseStorage.js:9` (`window.globalSupabaseClient`),
  `mobile/www/js/data-service.js:84-86` (`configureSupabase` cria o client), `mobile/www/supabase-config.js:11`
  (chave anon hardcoded, JWT `"role":"anon"`), `mobile/www/index.html:100-106` (caminho alternativo morto —
  `window.supabaseConfig` nunca é atribuído em lugar nenhum). RLS ativa: `desktop/supabase/migrations/04-rls-v3-anon-shared-only.sql`
  (`anon_read_shared` = único grant a anon, SELECT em `shared/%`). Pipeline mobile ativo no login:
  `mobile/www/js/auth-manager.js:266-268,638-663` (`_startSyncAdapter`), `mobile/www/js/sync/SyncAdapter.js:83,91`
  (`pushPending`/`pull`).

---

## 8. `sync_event_index`: tabela Postgres substitui Manifest + transporte `.enc` em Storage

> Status: **IMPLEMENTADO** (2026-06-11). Resolve V4 (idempotência Supabase/LAN do Mecanismo A), V5
> (duplicação TS↔JS, consolidada em `packages/core/sync`) e V8 (mobile/anon sem caminho de escrita)
> de uma vez — o ponto de contenção dos três era o mesmo: o "manifest"
> `shared/manifests/manifest_{routingId}.json` e os arquivos `.enc` em `orgs/.../eventos/...`,
> ambos removidos. Migração `desktop/supabase/migrations/05-sync-event-index.sql` aplicada;
> `desktop/scripts/verify-sync-event-index.ts` confirmou roundtrip `BYTEA` via hex (`\x...`).
> Decisão de segurança adotada: sem RLS por `org_id` em `sync_event_index` — acesso exclusivo via
> as duas RPCs `SECURITY DEFINER` (Opção B), tabela sem `GRANT` direto a `anon`/`authenticated`.

### 8.1 Por que o design atual quebra

- `Manifest` é **um arquivo por `routing_id`**, sobrescrito a cada `update()`. Duas escritas
  concorrentes (desktop + mobile no mesmo roteamento) → última vence, `seq`/`last_event_id` do
  perdedor é descartado silenciosamente. Não há transação.
- `seq` é hoje um **contador local** (`fila_eventos_sync`/IndexedDB) embutido no nome do arquivo
  (`evt_{seq}_{id}.enc`) — não é uma ordem global, é "a posição na fila de quem publicou".
- `anon` (mobile) precisaria de INSERT em `orgs/%/eventos/%` + UPDATE em `shared/manifests/%` para
  publicar, e SELECT em `orgs/%/eventos/%` para puxar — **três permissões que a v3 não concede e
  que não cabem no modelo "shared/% = público"** sem reabrir o bucket inteiro a anon (regressão
  para a v2, que foi removida por motivo de segurança).

### 8.2 Schema

> Nota de implementação: o SQL aplicado (`05-sync-event-index.sql`) difere em detalhes menores
> deste rascunho — `aggregate_type`/`aggregate_id` ficaram `NULL`able (nem todo evento tem
> agregado), e `rpc_push_sync_event` ganhou um `SELECT ... WHERE id = p_id` inicial para
> idempotência explícita por `id` antes do loop de atribuição de `seq`. O esquema abaixo
> permanece como referência do desenho original.

```sql
CREATE TABLE sync_event_index (
  id             UUID PRIMARY KEY,            -- = EventEnvelope.id (uuidv7, gerado no device)
  org_id         TEXT NOT NULL DEFAULT 'ecoforms-org-001',
  routing_id     TEXT NOT NULL,
  routing_type   TEXT NOT NULL,
  seq            BIGINT NOT NULL,             -- ordem global, atribuída pelo Postgres (ver 8.3)
  event_type     TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id   TEXT NOT NULL,
  device_id      TEXT NOT NULL,
  checksum       TEXT NOT NULL,               -- buildChecksum(envelope), igual ao já usado hoje
  prev_event_id  UUID,
  payload_enc    BYTEA NOT NULL,              -- ciphertext AES-256-GCM (mesmo que iria pro .enc)
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (routing_id, seq)
);

CREATE INDEX sync_event_index_routing_seq ON sync_event_index (routing_id, seq);
```

`org_id` fica como coluna por completude/auditoria, mas **não é usado em RLS hoje** — o projeto
Supabase já é o limite do tenant (mesma premissa de `shared/%` ser legível por qualquer anon na v3).

`payload_enc` guarda o **ciphertext direto** (o que hoje vira `evt_{seq}_{id}.enc`). Justificativa:
- Elimina o problema de permissão de Storage para `orgs/%/eventos/%` por completo — todo o
  Mecanismo A passa a ser só Postgres (RPC), nada de Storage para `anon`.
- Elimina o risco de inconsistência "upload no Storage funcionou, registro do índice falhou" (ou
  vice-versa) — é um único INSERT, atômico.
- Payloads são dados de domínio (campos de formulário, mudança de status), não anexos binários —
  fotos continuam por `OfflineStorageService`/`users/{userId}/images/`, fora deste fluxo. Tamanho
  típico (JSON de envelope) é KB, não MB; `BYTEA`/TOAST do Postgres lida bem com isso.
- Se no futuro o volume justificar, `payload_enc` pode virar um ponteiro (`storage_path`) sem mudar
  a interface das RPCs — decisão adiável, não bloqueia o design agora.

### 8.3 RPCs (`SECURITY DEFINER`) — único ponto de acesso para `anon` e `authenticated`

> Decisão final (Opção B, divergente deste rascunho): **sem** policy/GRANT direto para
> `authenticated` na tabela. RLS habilitada sem nenhuma policy + `REVOKE ALL FROM anon,
> authenticated` — a tabela é inacessível via PostgREST para qualquer role; o único acesso é
> via as duas RPCs (que rodam com privilégios do owner, ignorando RLS). Isso evita modelar
> isolamento por `org_id` agora (o mobile chama as RPCs como `anon`, sem `auth.uid()`), mantendo
> a coluna `org_id` disponível para uma policy multi-tenant futura. `rpc_pull_sync_events` também
> ganhou um terceiro parâmetro `p_limit INT DEFAULT 50` para paginação.

```sql
CREATE OR REPLACE FUNCTION rpc_push_sync_event(
  p_id UUID, p_routing_id TEXT, p_routing_type TEXT, p_event_type TEXT,
  p_aggregate_type TEXT, p_aggregate_id TEXT, p_device_id TEXT,
  p_checksum TEXT, p_prev_event_id UUID, p_payload_enc BYTEA
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_seq BIGINT;
BEGIN
  LOOP
    SELECT COALESCE(MAX(seq), 0) + 1 INTO v_seq
      FROM sync_event_index WHERE routing_id = p_routing_id;
    BEGIN
      INSERT INTO sync_event_index
        (id, routing_id, routing_type, seq, event_type, aggregate_type,
         aggregate_id, device_id, checksum, prev_event_id, payload_enc)
      VALUES
        (p_id, p_routing_id, p_routing_type, v_seq, p_event_type, p_aggregate_type,
         p_aggregate_id, p_device_id, p_checksum, p_prev_event_id, p_payload_enc);
      RETURN v_seq;
    EXCEPTION WHEN unique_violation THEN
      CONTINUE; -- outro device pegou esse seq entre o SELECT e o INSERT; tenta o próximo
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION rpc_pull_sync_events(p_routing_id TEXT, p_since_seq BIGINT)
RETURNS SETOF sync_event_index
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM sync_event_index
  WHERE routing_id = p_routing_id AND seq > p_since_seq
  ORDER BY seq;
$$;

ALTER TABLE sync_event_index ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sync_event_index FROM anon, authenticated;

-- authenticated (desktop) também enxerga a tabela diretamente (debug/admin/relatórios)
CREATE POLICY auth_full ON sync_event_index FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON sync_event_index TO authenticated;

GRANT EXECUTE ON FUNCTION rpc_push_sync_event TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rpc_pull_sync_events TO anon, authenticated;
```

`anon` (mobile) **não recebe nenhum GRANT na tabela** — só `EXECUTE` nas duas funções. Isso é
estritamente mais restrito que a v3 atual (que ao menos dá SELECT em `shared/%`), e ainda assim
**habilita** o caminho de escrita que hoje não existe para anon — o oposto do que parecia
necessário ("abrir mais Storage para anon"), porque a superfície exposta é uma função com
parâmetros tipados, não um path de bucket.

### 8.4 Fluxo de escrita (`TransportService.publish` / `pushPending`)

1. Constrói o envelope (`createEnvelope`/`sealEnvelope`, **inalterado** — `packages/core/sync`).
2. Criptografa o payload (AES-256-GCM via `CryptoLayer`, **inalterado**).
3. Em vez de upload no Storage + `Manifest.update()`, chama:
   ```ts
   const { data: seq, error } = await supabase.rpc('rpc_push_sync_event', {
     p_id: envelope.id,
     p_routing_id: envelope.source.routing_id,
     p_routing_type: envelope.source.routing_type,
     p_event_type: envelope.type,
     p_aggregate_type: envelope.aggregate.type,
     p_aggregate_id: envelope.aggregate.id,
     p_device_id: envelope.source.device_id,
     p_checksum: envelope.checksum,
     p_prev_event_id: envelope.prev_event_id,
     p_payload_enc: ciphertext, // bytea
   });
   ```
4. `seq` retornado é **ordem global** — grava em `fila_eventos_sync`/IndexedDB como confirmação de
   envio (situacao = 'enviado'), mas **não é mais usado por outros devices para nomear arquivos**
   (não existem mais arquivos).

### 8.5 Fluxo de leitura (`InboundService.pull`)

1. Lê o cursor local (`manifesto_sync.sequencia` no desktop / `syncDeviceLog` no mobile —
   **tabelas inalteradas**, só muda o que elas representam: "maior `seq` global aplicado").
2. ```ts
   const { data: rows } = await supabase.rpc('rpc_pull_sync_events', {
     p_routing_id: routingId,
     p_since_seq: localSeq,
   });
   ```
3. Para cada `row` (em ordem de `seq`): decripta `row.payload_enc`, valida `row.checksum`, aplica via
   `HandlerRegistry` + `ConflictResolver` (**inalterados**).
4. Atualiza o cursor local para `MAX(row.seq)`.

`hasNewEvents()` vira `rpc_pull_sync_events(routingId, localSeq)` não-vazio (ou, para um poll mais
barato, uma terceira RPC `rpc_get_max_seq(routing_id) RETURNS BIGINT` com `SELECT MAX(seq) ...`).

### 8.6 O que é removido

- `Manifest.ts` / `Manifest.js` — inteiros. `fetchForRouting()`/`update()` não existem mais;
  `getLocalSeq()`/`updateLocalSeq()` migram para `TransportService`/`InboundService` (mesma tabela
  de cursor, novo significado de "seq").
- Upload/download de `.enc` em `orgs/{orgId}/eventos/{routingId}/...` — Storage deixa de ser usado
  para Tier A. `shared/manifests/manifest_*.json` deixa de existir.
- Como nada está em produção (premissa geral do ADR), **é substituição direta**, sem dual-write
  nem período de coexistência: trocar a implementação de `TransportService`/`InboundService` (TS e
  JS) pelas chamadas RPC acima, apagar `Manifest.*` e os paths `orgs/%/eventos/%` /
  `shared/manifests/%` da RLS (`04-rls-v3-anon-shared-only.sql` não precisa de novas policies de
  Storage — só os `GRANT`/RPC acima, em uma nova migration `05-sync-event-index.sql`).

### 8.7 Tier B inalterado

`shared/users.json`, `shared/tasks.json`, `shared/data_registry.json`, `shared/ecoponto_caixas.json`
etc. continuam exatamente como hoje (Storage JSON, `anon_read_shared`, publicados pelo
`UserSnapshotService`/`CrmSnapshotPublisher`/equivalentes). Esta proposta toca **somente** o
Mecanismo A (event log).

### 8.8 Consolidação V5 (TS↔JS)

Com o transporte reduzido a "duas RPCs + criptografia local", a superfície a duplicar entre
`TransportService.ts`/`.js` e `InboundService.ts`/`.js` encolhe para: montar parâmetros da RPC,
decriptar payload, aplicar handler. Isso é pequeno o suficiente para mover para
`packages/core/sync` (que já expõe `EventEnvelope`/`ConflictResolver`/`stableStringify` para os
dois lados) — `TransportService`/`InboundService` em TS e JS passam a ser wrappers finos sobre um
`SyncCore` compartilhado + `CryptoLayer` específico de cada plataforma (Rust vs WebCrypto).
