# Sync via GAS-broker + Google Workspace — Design

**Data:** 2026-07-08
**Status:** Aprovado (design) — pendente plano de implementação
**Módulo alvo:** `ecoforms/desktop` (Tauri + Next.js) e `ecoforms/mobile` (Capacitor)
**Regra não-negociável:** domínio e `HandlerRegistry` permanecem **intocados**. A mudança é uma **troca de transporte** na camada `infrastructure/sync`.

---

## 1. Objetivo e motivação

A TI da organização está migrando o armazenamento de rede para **Google Workspace**. O EcoForms precisa parar de depender de pasta LAN/SMB e, ao mesmo tempo, **manter o modelo local-first** e o pipeline de eventos cifrados já existente.

Este design substitui o **transporte** de sync (hoje: push/pull de eventos para o Supabase Storage com `manifest_{routingId}.json`) por:

- **Google Apps Script (GAS)** como **broker / escritor único serializado**.
- **Google Workspace (Drive)** como armazém de objetos canônico.
- **Supabase** rebaixado de armazém para **change-feed opaco** (tabela de sinal) + **espelho de leitura** para os dispositivos de campo.

O domínio, os handlers e a criptografia **não mudam**. É uma troca de adaptador.

## 2. Decisões travadas (brainstorming 2026-07-08)

| # | Decisão | Escolha |
|---|---|---|
| 1 | Local-first | **Mantido.** CRUD local sobre o que foi baixado; `SyncOutbox` continua sendo a fila de saída. |
| 2 | Papel do GAS | **Escritor único + notificador** (híbrido). Toda **escrita** passa pelo GAS; **leitura** os devices fazem direto. GAS fora do read hot path (exceto `midia/` on-demand). |
| 3 | Fronteira de cifragem | GAS toca **apenas ciphertext**. Chave PBKDF2 nunca sai do device (`CryptoLayer`). |
| 4 | Autenticação | **Mista.** Desktop → OAuth Google (lê Drive direto). Campo → login de app + **token de instância** (lê Supabase Storage). |
| 5 | Fan-out de escrita | **Drive canônico + espelho no Supabase Storage** para `events/` e `shared/`. `midia/` fica **só no Drive**, buscado on-demand via URL assinada emitida pelo GAS. |
| 6 | Replicação | **Íntegra** — todo device baixa todo `shared/` + `events/`. `seq` **global por stream**, sem chave de partição (ver §9 sobre extensibilidade futura). |
| 7 | Consumo do sinal | **Supabase Realtime (push) + fallback de poll** na reconexão/recuperação offline. |
| 8 | Ordenação/conflito | `seq` por stream dá ordem total por stream. Conflitos concorrentes resolvidos pelo **`ConflictResolver` (LWW+hash) do `ecoforms-core`** — reusado, não reescrito. |
| 9 | Idempotência | `event_id` (uuid v7) **gerado no device**, deduplicado pelo GAS em retries. |

## 3. Arquitetura (topologia)

```
Device (Tauri desktop / Capacitor campo)
   local-first: SQLite/IndexedDB + SyncOutbox (existente)
        │
        │ WRITE: envelope cifrado ─────────────►  GAS (web-app — escritor único)
        │                                              │ 1. valida credencial (Google OU token de instância)
        │                                              │ 2. LockService serializa
        │                                              │ 3. dedup por event_id
        │                                              │ 4. atribui seq = último+1 do stream
        │                                              │ 5. grava Drive canônico
        │                                              │ 6. espelha Supabase Storage (events/shared)
        │                                              │ 7. insere linha de sinal (opaca)
        │                                              ▼
        │ READ desktop ◄── Drive API (Google)      Supabase
        │ READ campo   ◄── Supabase Storage           ├── tabela de sinal (change-feed opaco)
        │ SIGNAL ◄──── Supabase Realtime (+poll)       └── Storage mirror (events/shared)
        │ MIDIA on-demand ◄── URL assinada (GAS)
        ▼
   InboundService → CryptoLayer → HandlerRegistry → domínio (INTOCADOS)
```

## 4. Tabela de sinal (Supabase) — change-feed opaco

Substitui o papel dos `manifest_{routingId}.json` de hoje. Uma linha por objeto publicado. **Nenhum conteúdo do objeto** aparece — só ponteiros e metadados estruturais/verificação.

```sql
CREATE TABLE sync_signal (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  stream       TEXT NOT NULL,          -- 'events' | 'shared:cadastros' | 'shared:geo' | ...
  seq          BIGINT NOT NULL,        -- monotônico POR stream (atribuído pelo GAS)
  folder       TEXT NOT NULL,          -- 'events' | 'shared' | 'midia' | 'archived'
  object_path  TEXT NOT NULL,          -- caminho no Drive + chave no Storage (mesma convenção)
  size_bytes   INTEGER NOT NULL,
  checksum     TEXT NOT NULL,          -- hash do ciphertext
  event_id     TEXT NOT NULL,          -- uuid v7 gerado no device (idempotência)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stream, seq),
  UNIQUE (event_id)
);
CREATE INDEX idx_sync_signal_stream_seq ON sync_signal(stream, seq);
```

- **RLS:** leitura liberada para instâncias autenticadas (Realtime); escrita **apenas** pela credencial do GAS.
- O device guarda `last_applied_seq` por stream e puxa somente o intervalo `(last_applied_seq, max]`.

## 5. Layout de objetos (Drive canônico / Storage espelho)

Convenção de caminho idêntica nos dois armazéns, para o `object_path` do sinal servir aos dois:

```
{folder}/{stream}/evt_{seq}_{event_id}.enc     -- events/ e shared/  (ciphertext)
midia/{stream}/{event_id}/{arquivo}.enc         -- só no Drive; on-demand
archived/{stream}/{periodo}.parquet             -- Parquet de auditoria (ver §8, tentativo)
```

| Pasta | Conteúdo | Onde vive | Como chega ao device |
|---|---|---|---|
| `shared/` | Dados perenes (geometrias, cadastros) | Drive + Storage | Integral, no fluxo de sinal |
| `events/` | Tarefas e dados de transição | Drive + Storage | Integral, no fluxo de sinal |
| `midia/` | Binários (fotos) | **Só Drive** | On-demand via URL assinada do GAS |
| `archived/` | Parquet frio para auditoria | Drive | Fora do hot path; DuckDB local (§8) |

## 6. Fluxos

### 6.1 Escrita (todos os devices → GAS)
1. Device gera `event_id` (uuid v7) e cifra o envelope (`EventEnvelope v2` + AES-256-GCM via `CryptoLayer`; chave nunca sai do device).
2. `POST` ao web-app GAS: `{ stream, event_id, ciphertext, folder }` + credencial (Google id-token no desktop; token de instância no campo).
3. GAS, dentro de `LockService` (serialização global):
   - se `event_id` já existe → responde o `seq` existente (idempotente em retries);
   - senão `seq = MAX(seq do stream) + 1`;
   - grava `evt_{seq}_{event_id}.enc` no Drive (canônico);
   - se `folder ∈ {events, shared}` → espelha o mesmo blob no Supabase Storage;
   - insere a linha em `sync_signal`.
4. GAS responde `{ seq }`. Falha de rede / GAS indisponível → o item **permanece no `SyncOutbox` local** e drena depois (garantia offline-first).

### 6.2 Leitura
- **Desktop:** Realtime notifica → `InboundService` baixa do **Drive** os `seq` faltantes → `CryptoLayer` decifra → `HandlerRegistry` aplica.
- **Campo:** idem, baixando do **Supabase Storage**.
- **`midia/`:** fora do fluxo; ao renderizar uma foto, o device solicita ao GAS uma **URL assinada** e busca o binário sob demanda.

### 6.3 Consumo do sinal
- Assinatura **Supabase Realtime** na tabela `sync_signal` → acorda quase instantaneamente.
- **Fallback de poll** (`SELECT ... WHERE stream = ? AND seq > last_applied_seq`) na reconexão e recuperação offline, para fechar buracos perdidos enquanto o websocket esteve fora.

## 7. Ordenação, conflito e idempotência

- **Ordem total por stream** vinda do `seq` atribuído pelo GAS (escritor único) — mais forte que o modelo atual baseado em manifest.
- **Conflitos** de edição concorrente ao mesmo objeto lógico: resolvidos pelo **`ConflictResolver` (LWW+hash)** existente em `ecoforms-core/sync`. Reusado sem alteração.
- **Idempotência:** `event_id` gerado no device; o GAS deduplica em retries; a tabela tem `UNIQUE(event_id)`.

## 8. Arquivamento (EM ABERTO — tentativo)

> Esta seção **não bloqueia** o núcleo do sync. Direção preliminar, a detalhar em spec/plano próprios.

- `events` frios → compactados em **Parquet** e guardados em `archived/` no Drive, para **auditoria**.
- **DuckDB local no PC** como camada de consulta histórica e **fallback caso a rede/Workspace seja extinta** (DuckDB lê Parquet direto).
- **Ponto crítico a resolver:** quem gera o Parquet. O GAS **não** escreve Parquet nativamente e auditoria pressupõe dado **legível** — logo a compactação roda **fora do GAS** (job local) e **decifra no momento do arquivamento**, tocando a fronteira de cifragem. Retenção, disparo e responsabilidade do job ficam para o detalhamento.

## 9. Migração e extensibilidade (EM ABERTO — tentativo)

> Também não bloqueia o núcleo.

- **Migração** do transporte atual (Supabase Storage + manifests) para GAS/Workspace: provável **faseamento** — rodar os dois transportes em paralelo, validar convergência, então cortar o antigo.
- **Partição futura:** a replicação é íntegra hoje (§decisão 6), mas as chaves de `stream` são desenhadas **partition-agnostic e não-fechadas** (ex.: `shared:cadastros` já é um prefixo/escopo). Introduzir partição por setor/org depois (ex.: `shared:cadastros@setor-X`) não exige redesenho do protocolo de sinal — apenas mais streams e `seq` por stream. Hedge de design caso o volume no mobile cresça.

## 10. Encaixe no código atual (troca de adaptador)

**Novo:**
- `infrastructure/sync/GasWorkspaceTransport` — implementa a porta de transporte no lugar do push/pull para Storage do `TransportService`; conhece o web-app GAS, o Drive (desktop) e o Storage (campo).
- `infrastructure/sync/SignalFeed` — assinatura Realtime + poll fallback sobre `sync_signal`; entrega os `seq` faltantes ao `InboundService`.
- `GAS` (projeto Apps Script separado, versionado) — endpoint de escrita, `LockService`, atribuição de `seq`, fan-out Drive+Storage, escrita do sinal, emissão de URL assinada de `midia/`.

**Intocado:**
- `SyncPort`, `LazySyncAdapter`, `NullSyncAdapter`.
- `EventEnvelope v2`, `CryptoLayer`, `ConflictResolver`.
- `HandlerRegistry` e **todo o domínio**.
- `SyncOutbox` / `sync_event_queue` (fila local offline-first).

**Ajustado:**
- `InboundService` — passa a se alimentar do `SignalFeed` + Drive/Storage em vez do manifest.
- `StorageBootstrapService` — bootstrap de config passa a considerar a credencial GAS/instância.

## 11. Autenticação e segurança

| Classe de device | Auth de escrita (ao GAS) | Read path | Credencial |
|---|---|---|---|
| Desktop (Tauri) | Google id-token validado no GAS | **Drive** direto (Shared Drive) | OAuth Google (conta Workspace) |
| Campo (mobile) | **Token de instância** validado no GAS | **Supabase Storage** (RLS) | Login local do app + token no admin da instância |

- Token de instância configurado no **admin de cada instância** (é onde entra a "API do GAS").
- Refresh token Google (desktop) via keychain do SO — nunca em texto plano.
- GAS nunca recebe/armazena chave de cifragem; só ciphertext.

## 12. Disponibilidade / degradação

| Cenário | Comportamento |
|---|---|
| GAS ou Supabase fora | Escritas ficam no `SyncOutbox` local; leituras servem estado local. App segue funcional (local-first). |
| Websocket Realtime cai | Fallback de poll fecha os buracos na reconexão. |
| Retry de escrita | Idempotente por `event_id`; nunca duplica. |
| Rede **extinta de vez** | `archived/` (Parquet) + **DuckDB local** viram a memória histórica consultável (§8). |

## 13. Testes (TDD)

- **Domínio / HandlerRegistry:** sem mudanças (regra do projeto preservada).
- **`GasWorkspaceTransport`:** contrato com GAS mockado (HTTP) — escrita idempotente, fan-out Drive+Storage, resposta de `seq`, comportamento offline (item permanece no outbox).
- **`SignalFeed`:** Realtime fake + poll fallback; recuperação de buracos por `seq`.
- **`InboundService` (ajustado):** consome sinal → baixa faltantes → aplica em ordem por `seq`.
- **GAS (Apps Script):** testes do script — serialização por `LockService`, atribuição de `seq`, dedup por `event_id`, emissão de URL assinada.
- **Idempotência/conflito:** reuso das suítes de `ConflictResolver`.

## 14. Fora de escopo (YAGNI)

- ❌ Escrita direta device→Drive (quebraria o escritor serializado).
- ❌ GAS no read hot path (exceto `midia/` on-demand).
- ❌ Partição por setor/org **agora** (só o hedge de design, §9).
- ❌ Detalhamento de arquivamento/DuckDB e migração — seções em aberto (§8, §9).
- ❌ Sync bidirecional com serviços Google além do próprio EcoForms.

## 15. Riscos & mitigações

| Risco | Mitigação |
|---|---|
| Cota do Apps Script no hot path | GAS só na **escrita** (volume menor) + `midia/` on-demand; leitura sai por Drive/Storage. |
| Escritor único = ponto de falha | Offline-first: `SyncOutbox` acumula e drena; sem perda de dados. |
| Duplicação de armazenamento (Drive+Storage) | Só ciphertext pequeno de `events/shared`; `midia/` (pesado) não é duplicado. |
| Volume íntegro estoura o mobile | Streams partition-agnostic (§9) permitem introduzir partição sem redesenho. |
| Ciphertext exposto no GAS/Drive | Chave nunca sai do device; GAS/Drive só veem blobs AES-256-GCM. |
| Parquet de auditoria toca cifragem | Job de arquivamento fora do GAS, decifra local sob controle (a detalhar, §8). |
