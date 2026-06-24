# P2P Local Sync Sem LAN Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local peer-to-peer sync path for EcoForms Desktop that does not depend on a shared LAN folder and keeps the current backend/Supabase path as the cloud convergence layer.

**Architecture:** Keep SQLite as the local source of truth and reuse the existing event sync model. Add a local peer transport that exchanges encrypted sync event index rows between trusted desktop devices, then let the existing `InboundService` decrypt, validate, sequence-check, and apply events. Google Workspace must be treated as a cloud service or document store, not as a LAN-folder replacement for sync consistency.

**Tech Stack:** Tauri v2, Rust 2021, Next.js/React, TypeScript, Vitest, SQLite through `SqlitePort`, existing `ecoforms-core` sync contracts, existing `TransportService` and `InboundService`.

---

## Scope

This plan proposes a phased implementation. The first production-worthy milestone is LAN-independent local peer sync over an explicit peer list. Automatic discovery, Google Workspace relay, and device signatures are separate follow-up phases.

The plan intentionally does not use Google Drive mounted folders as a sync queue. Drive file sync has eventual consistency, conflict copies, background cache delays, and weak ordering guarantees. It is acceptable for attachments, exports, or a later API-based cloud relay, but not as the primary local event bus.

## Existing Anchors

- `src/application/ports/SyncPort.ts`: app-facing sync contract.
- `src/infrastructure/sync/SyncOutbox.ts`: writes domain events or pending intents.
- `src/infrastructure/sync/TransportService.ts`: creates event envelopes and pushes pending events to a `SyncEventIndexPort`.
- `src/infrastructure/sync/InboundService.ts`: pulls remote rows, decrypts envelopes, checks sequence gaps, validates payloads, and dispatches handlers.
- `src/infrastructure/sync/lazy-sync.ts`: selects the current Supabase index factory.
- `src/test/fakes/FakeSyncEventIndex.ts`: useful reference for an in-memory `SyncEventIndexPort`.
- `src/infrastructure/storage/LanFileStorage.ts`, `LanDomainSyncService.ts`, `LanPullService.ts`: existing LAN folder path. Treat as legacy/optional and do not extend for the new P2P path.

## Proposed Runtime Topology

```text
Desktop A
  SQLite
  SyncOutbox
  TransportService
  CompositeSyncEventIndex
      SupabaseSyncEventIndex, when internet exists
      LocalPeerSyncEventIndex, when peers are reachable

Desktop B
  LocalPeerServer
  LocalPeerSyncEventIndex
  InboundService
```

Each desktop can push local encrypted rows to configured peers and pull encrypted rows from configured peers. The local peer path transports the same row shape that Supabase currently stores for `sync_event_index`; it does not expose raw tables or domain snapshots.

## Non-Negotiable Constraints

- Do not replicate SQLite files.
- Do not upsert arbitrary JSON snapshots into business tables.
- Do not depend on a mapped Google Drive folder.
- Do not require a shared SMB/Windows network folder.
- Do not apply inbound peer data outside `InboundService`.
- Do not trust peer identity based only on IP address.
- Keep backend/Supabase as the cloud convergence path for now.

## File Structure

### Create

- `src/infrastructure/sync/local-peer/LocalPeerTypes.ts`
  Defines peer configuration, row DTOs, request/response schemas, and conversion helpers.

- `src/infrastructure/sync/local-peer/LocalPeerClient.ts`
  Talks to configured peers through Tauri commands. No direct `fetch` from the webview.

- `src/infrastructure/sync/local-peer/LocalPeerSyncEventIndex.ts`
  Implements `SyncEventIndexPort` using local peers as the backing transport.

- `src/infrastructure/sync/CompositeSyncEventIndex.ts`
  Fan-out push to multiple indexes and pull merge across indexes.

- `src/infrastructure/sync/local-peer/__tests__/LocalPeerSyncEventIndex.test.ts`
  Unit tests for push, pull, idempotency, peer failures, and row ordering.

- `src/infrastructure/sync/__tests__/CompositeSyncEventIndex.test.ts`
  Unit tests for backend + peer composition.

- `src-tauri/src/commands/local_peer.rs`
  Rust commands for local peer HTTP client and optional server lifecycle.

- `docs/adr/ADR-077-p2p-local-sync-sem-lan.md`
  Architecture decision record for P2P without shared LAN storage.

### Modify

- `src/infrastructure/sync/lazy-sync.ts`
  Build a composite index when local peer sync is enabled.

- `src/infrastructure/container.ts`
  Expose peer sync configuration services if needed by UI/hooks.

- `src-tauri/src/lib.rs`
  Register local peer Tauri commands.

- `src-tauri/Cargo.toml`
  Add only the minimal Rust networking dependency selected during implementation.

- `docs/security-audit-2026-06-19.md`
  Add a follow-up note that the new P2P path must not reuse unauthenticated LAN snapshot ingestion.

---

## Phase 1: ADR And Boundary Decision

### Task 1: Write ADR For P2P Without LAN Folder

**Files:**
- Create: `docs/adr/ADR-077-p2p-local-sync-sem-lan.md`

- [ ] **Step 1: Create the ADR**

Content:

```markdown
# ADR-077: Sync P2P local sem pasta LAN compartilhada

## Status

Proposto

## Contexto

A TI migrará dados de rede para Google Workspace. Portanto, o EcoForms Desktop não pode depender da existência futura de uma pasta compartilhada LAN/SMB. O app já possui um modelo de sync baseado em eventos, com `SyncOutbox`, `TransportService`, `SyncEventIndexPort` e `InboundService`.

## Decisão

Implementar sync P2P local como transporte de eventos cifrados, não como replicação de arquivos SQLite nem snapshots JSON de tabelas. O backend/Supabase permanece como camada cloud de convergência. Google Workspace pode ser usado para anexos, exportações ou relay cloud futuro via API, mas não como fila de arquivos montada no desktop.

## Consequências

- A nova camada P2P transporta rows compatíveis com `sync_event_index`.
- A aplicação dos dados continua centralizada no `InboundService`.
- O `LanPullService` não deve ser expandido para esse caso.
- A primeira versão pode usar peers configurados manualmente.
- Descoberta automática e assinatura por dispositivo entram em fases posteriores.

## Riscos

- Firewalls podem bloquear portas locais.
- Dispositivos precisam de pareamento explícito.
- Sem assinatura por dispositivo, a autenticidade ainda depende da chave simétrica de sync. A fase de produção deve incluir assinatura Ed25519 por dispositivo.
```

- [ ] **Step 2: Verify ADR exists**

Run:

```bash
sed -n '1,220p' docs/adr/ADR-077-p2p-local-sync-sem-lan.md
```

Expected: prints the ADR with `Status`, `Contexto`, `Decisão`, `Consequências`, and `Riscos`.

- [ ] **Step 3: Commit**

```bash
git add docs/adr/ADR-077-p2p-local-sync-sem-lan.md
git commit -m "docs: record p2p local sync direction"
```

---

## Phase 2: Local Peer Contract In TypeScript

### Task 2: Define Local Peer Types

**Files:**
- Create: `src/infrastructure/sync/local-peer/LocalPeerTypes.ts`

- [ ] **Step 1: Write the failing type-level and runtime tests**

Create `src/infrastructure/sync/local-peer/__tests__/LocalPeerTypes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parsePeerRowsResponse } from '../LocalPeerTypes';

describe('LocalPeerTypes', () => {
  it('accepts a valid peer rows response', () => {
    const parsed = parsePeerRowsResponse({
      rows: [{
        id: 'evt-1',
        routing_id: 'setor-a',
        routing_type: 'setor',
        seq: 1,
        event_type: 'task.criada',
        aggregate_type: 'task',
        aggregate_id: 't1',
        device_id: 'desktop-a',
        checksum: 'abc',
        prev_event_id: null,
        payload_enc_b64: 'AQID',
        created_at: '2026-06-22T00:00:00.000Z',
      }],
    });

    expect(parsed.rows[0].id).toBe('evt-1');
    expect(parsed.rows[0].payload_enc).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('rejects malformed peer rows response', () => {
    expect(() => parsePeerRowsResponse({ rows: [{ id: 123 }] })).toThrow(/Invalid peer rows response/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/infrastructure/sync/local-peer/__tests__/LocalPeerTypes.test.ts
```

Expected: FAIL because `LocalPeerTypes.ts` does not exist.

- [ ] **Step 3: Implement the type module**

Create `src/infrastructure/sync/local-peer/LocalPeerTypes.ts`:

```ts
import { z } from 'zod';
import type { SyncEventIndexRow } from 'ecoforms-core';

export interface LocalPeerConfig {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  sharedToken: string;
}

const PeerRowDtoSchema = z.object({
  id: z.string().min(1),
  routing_id: z.string().min(1),
  routing_type: z.string().min(1),
  seq: z.number().int().positive(),
  event_type: z.string().min(1),
  aggregate_type: z.string().nullable(),
  aggregate_id: z.string().nullable(),
  device_id: z.string().min(1),
  checksum: z.string().min(1),
  prev_event_id: z.string().nullable(),
  payload_enc_b64: z.string().min(1),
  created_at: z.string().min(1),
});

const PeerRowsResponseSchema = z.object({
  rows: z.array(PeerRowDtoSchema),
});

export type PeerRowDto = z.infer<typeof PeerRowDtoSchema>;

function decodeB64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}

function encodeB64(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value));
}

export function toPeerRowDto(row: SyncEventIndexRow): PeerRowDto {
  return {
    id: row.id,
    routing_id: row.routing_id,
    routing_type: row.routing_type,
    seq: row.seq,
    event_type: row.event_type,
    aggregate_type: row.aggregate_type,
    aggregate_id: row.aggregate_id,
    device_id: row.device_id,
    checksum: row.checksum,
    prev_event_id: row.prev_event_id,
    payload_enc_b64: encodeB64(row.payload_enc),
    created_at: row.created_at,
  };
}

export function fromPeerRowDto(dto: PeerRowDto): SyncEventIndexRow {
  return {
    id: dto.id,
    routing_id: dto.routing_id,
    routing_type: dto.routing_type,
    seq: dto.seq,
    event_type: dto.event_type,
    aggregate_type: dto.aggregate_type,
    aggregate_id: dto.aggregate_id,
    device_id: dto.device_id,
    checksum: dto.checksum,
    prev_event_id: dto.prev_event_id,
    payload_enc: decodeB64(dto.payload_enc_b64),
    created_at: dto.created_at,
  };
}

export function parsePeerRowsResponse(value: unknown): { rows: SyncEventIndexRow[] } {
  const parsed = PeerRowsResponseSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid peer rows response: ${parsed.error.message}`);
  }
  return { rows: parsed.data.rows.map(fromPeerRowDto) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/infrastructure/sync/local-peer/__tests__/LocalPeerTypes.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/sync/local-peer/LocalPeerTypes.ts src/infrastructure/sync/local-peer/__tests__/LocalPeerTypes.test.ts
git commit -m "feat: define local peer sync row contract"
```

---

## Phase 3: Peer Index In TypeScript

### Task 3: Implement LocalPeerSyncEventIndex

**Files:**
- Create: `src/infrastructure/sync/local-peer/LocalPeerClient.ts`
- Create: `src/infrastructure/sync/local-peer/LocalPeerSyncEventIndex.ts`
- Create: `src/infrastructure/sync/local-peer/__tests__/LocalPeerSyncEventIndex.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/infrastructure/sync/local-peer/__tests__/LocalPeerSyncEventIndex.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { PushEventParams, SyncEventIndexRow } from 'ecoforms-core';
import { LocalPeerSyncEventIndex } from '../LocalPeerSyncEventIndex';
import type { LocalPeerClientPort } from '../LocalPeerClient';
import type { LocalPeerConfig } from '../LocalPeerTypes';

function peer(id: string): LocalPeerConfig {
  return { id, name: id, baseUrl: `http://${id}.local:8787`, enabled: true, sharedToken: 'token' };
}

function pushParams(id: string): PushEventParams {
  return {
    id,
    routingId: 'setor-a',
    routingType: 'setor',
    eventType: 'task.criada',
    aggregateType: 'task',
    aggregateId: 't1',
    deviceId: 'desktop-a',
    checksum: 'checksum',
    prevEventId: null,
    payloadEnc: new Uint8Array([1, 2, 3]),
  };
}

describe('LocalPeerSyncEventIndex', () => {
  it('pushEvent sends the event to every enabled peer and returns a local sequence', async () => {
    const client: LocalPeerClientPort = {
      pushEvent: vi.fn(async () => ({ accepted: true })),
      pullEvents: vi.fn(async () => []),
    };
    const index = new LocalPeerSyncEventIndex([peer('p1'), peer('p2')], client);

    const seq = await index.pushEvent(pushParams('evt-1'));

    expect(seq).toBe(1);
    expect(client.pushEvent).toHaveBeenCalledTimes(2);
  });

  it('pullEvents merges rows from peers, removes duplicates, and sorts by sequence', async () => {
    const row1: SyncEventIndexRow = {
      id: 'evt-1',
      routing_id: 'setor-b',
      routing_type: 'setor',
      seq: 1,
      event_type: 'task.criada',
      aggregate_type: 'task',
      aggregate_id: 't1',
      device_id: 'desktop-b',
      checksum: 'c1',
      prev_event_id: null,
      payload_enc: new Uint8Array([1]),
      created_at: '2026-06-22T00:00:00.000Z',
    };
    const row2 = { ...row1, id: 'evt-2', seq: 2, checksum: 'c2', payload_enc: new Uint8Array([2]) };
    const client: LocalPeerClientPort = {
      pushEvent: vi.fn(async () => ({ accepted: true })),
      pullEvents: vi.fn(async (p) => p.id === 'p1' ? [row2, row1] : [row1]),
    };
    const index = new LocalPeerSyncEventIndex([peer('p1'), peer('p2')], client);

    const rows = await index.pullEvents('setor-b', 0, 50);

    expect(rows.map(r => r.id)).toEqual(['evt-1', 'evt-2']);
  });

  it('continues when one peer is offline', async () => {
    const row: SyncEventIndexRow = {
      id: 'evt-1',
      routing_id: 'setor-b',
      routing_type: 'setor',
      seq: 1,
      event_type: 'task.criada',
      aggregate_type: 'task',
      aggregate_id: 't1',
      device_id: 'desktop-b',
      checksum: 'c1',
      prev_event_id: null,
      payload_enc: new Uint8Array([1]),
      created_at: '2026-06-22T00:00:00.000Z',
    };
    const client: LocalPeerClientPort = {
      pushEvent: vi.fn(async () => ({ accepted: true })),
      pullEvents: vi.fn(async (p) => {
        if (p.id === 'p1') throw new Error('offline');
        return [row];
      }),
    };
    const index = new LocalPeerSyncEventIndex([peer('p1'), peer('p2')], client);

    const rows = await index.pullEvents('setor-b', 0, 50);

    expect(rows).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/infrastructure/sync/local-peer/__tests__/LocalPeerSyncEventIndex.test.ts
```

Expected: FAIL because `LocalPeerSyncEventIndex.ts` does not exist.

- [ ] **Step 3: Implement client port**

Create `src/infrastructure/sync/local-peer/LocalPeerClient.ts`:

```ts
import { invoke } from '@tauri-apps/api/core';
import type { PushEventParams, SyncEventIndexRow } from 'ecoforms-core';
import { parsePeerRowsResponse, toPeerRowDto, type LocalPeerConfig } from './LocalPeerTypes';

export interface LocalPeerClientPort {
  pushEvent(peer: LocalPeerConfig, params: PushEventParams): Promise<{ accepted: boolean }>;
  pullEvents(peer: LocalPeerConfig, routingId: string, sinceSeq: number, limit: number): Promise<SyncEventIndexRow[]>;
}

export class TauriLocalPeerClient implements LocalPeerClientPort {
  async pushEvent(peer: LocalPeerConfig, params: PushEventParams): Promise<{ accepted: boolean }> {
    return invoke<{ accepted: boolean }>('local_peer_push_event', {
      peer,
      row: toPeerRowDto({
        id: params.id,
        routing_id: params.routingId,
        routing_type: params.routingType,
        seq: 0,
        event_type: params.eventType,
        aggregate_type: params.aggregateType ?? null,
        aggregate_id: params.aggregateId ?? null,
        device_id: params.deviceId,
        checksum: params.checksum,
        prev_event_id: params.prevEventId ?? null,
        payload_enc: params.payloadEnc,
        created_at: new Date().toISOString(),
      }),
    });
  }

  async pullEvents(peer: LocalPeerConfig, routingId: string, sinceSeq: number, limit: number): Promise<SyncEventIndexRow[]> {
    const response = await invoke<unknown>('local_peer_pull_events', {
      peer,
      routingId,
      sinceSeq,
      limit,
    });
    return parsePeerRowsResponse(response).rows;
  }
}
```

- [ ] **Step 4: Implement local peer index**

Create `src/infrastructure/sync/local-peer/LocalPeerSyncEventIndex.ts`:

```ts
import type { PushEventParams, SyncEventIndexPort, SyncEventIndexRow } from 'ecoforms-core';
import type { LocalPeerClientPort } from './LocalPeerClient';
import type { LocalPeerConfig } from './LocalPeerTypes';

export class LocalPeerSyncEventIndex implements SyncEventIndexPort {
  private localSeqByRoutingId = new Map<string, number>();

  constructor(
    private readonly peers: LocalPeerConfig[],
    private readonly client: LocalPeerClientPort,
  ) {}

  async pushEvent(params: PushEventParams): Promise<number> {
    const enabledPeers = this.peers.filter(p => p.enabled);
    await Promise.allSettled(enabledPeers.map(peer => this.client.pushEvent(peer, params)));

    const current = this.localSeqByRoutingId.get(params.routingId) ?? 0;
    const next = current + 1;
    this.localSeqByRoutingId.set(params.routingId, next);
    return next;
  }

  async pullEvents(routingId: string, sinceSeq: number, limit = 50): Promise<SyncEventIndexRow[]> {
    const enabledPeers = this.peers.filter(p => p.enabled);
    const settled = await Promise.allSettled(
      enabledPeers.map(peer => this.client.pullEvents(peer, routingId, sinceSeq, limit)),
    );

    const byId = new Map<string, SyncEventIndexRow>();
    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      for (const row of result.value) {
        if (row.routing_id === routingId && row.seq > sinceSeq) {
          byId.set(row.id, row);
        }
      }
    }

    return [...byId.values()]
      .sort((a, b) => a.seq - b.seq || a.id.localeCompare(b.id))
      .slice(0, limit);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
npm test -- src/infrastructure/sync/local-peer/__tests__/LocalPeerSyncEventIndex.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/sync/local-peer
git commit -m "feat: add local peer sync event index"
```

---

## Phase 4: Composite Backend Plus P2P Index

### Task 4: Implement CompositeSyncEventIndex

**Files:**
- Create: `src/infrastructure/sync/CompositeSyncEventIndex.ts`
- Create: `src/infrastructure/sync/__tests__/CompositeSyncEventIndex.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/infrastructure/sync/__tests__/CompositeSyncEventIndex.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import type { PushEventParams, SyncEventIndexPort, SyncEventIndexRow } from 'ecoforms-core';
import { CompositeSyncEventIndex } from '../CompositeSyncEventIndex';

function params(): PushEventParams {
  return {
    id: 'evt-1',
    routingId: 'setor-a',
    routingType: 'setor',
    eventType: 'task.criada',
    aggregateType: 'task',
    aggregateId: 't1',
    deviceId: 'desktop-a',
    checksum: 'checksum',
    prevEventId: null,
    payloadEnc: new Uint8Array([1]),
  };
}

function row(id: string, seq: number): SyncEventIndexRow {
  return {
    id,
    routing_id: 'setor-b',
    routing_type: 'setor',
    seq,
    event_type: 'task.criada',
    aggregate_type: 'task',
    aggregate_id: 't1',
    device_id: 'desktop-b',
    checksum: `c-${id}`,
    prev_event_id: null,
    payload_enc: new Uint8Array([seq]),
    created_at: '2026-06-22T00:00:00.000Z',
  };
}

describe('CompositeSyncEventIndex', () => {
  it('pushEvent fans out and returns the primary sequence', async () => {
    const primary: SyncEventIndexPort = {
      pushEvent: vi.fn(async () => 10),
      pullEvents: vi.fn(async () => []),
    };
    const secondary: SyncEventIndexPort = {
      pushEvent: vi.fn(async () => 1),
      pullEvents: vi.fn(async () => []),
    };
    const index = new CompositeSyncEventIndex(primary, [secondary]);

    const seq = await index.pushEvent(params());

    expect(seq).toBe(10);
    expect(primary.pushEvent).toHaveBeenCalledOnce();
    expect(secondary.pushEvent).toHaveBeenCalledOnce();
  });

  it('pullEvents merges primary and secondary rows without duplicates', async () => {
    const primary: SyncEventIndexPort = {
      pushEvent: vi.fn(async () => 1),
      pullEvents: vi.fn(async () => [row('evt-2', 2), row('evt-1', 1)]),
    };
    const secondary: SyncEventIndexPort = {
      pushEvent: vi.fn(async () => 1),
      pullEvents: vi.fn(async () => [row('evt-1', 1), row('evt-3', 3)]),
    };
    const index = new CompositeSyncEventIndex(primary, [secondary]);

    const rows = await index.pullEvents('setor-b', 0, 50);

    expect(rows.map(r => r.id)).toEqual(['evt-1', 'evt-2', 'evt-3']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/infrastructure/sync/__tests__/CompositeSyncEventIndex.test.ts
```

Expected: FAIL because `CompositeSyncEventIndex.ts` does not exist.

- [ ] **Step 3: Implement composite index**

Create `src/infrastructure/sync/CompositeSyncEventIndex.ts`:

```ts
import type { PushEventParams, SyncEventIndexPort, SyncEventIndexRow } from 'ecoforms-core';

export class CompositeSyncEventIndex implements SyncEventIndexPort {
  constructor(
    private readonly primary: SyncEventIndexPort,
    private readonly secondary: SyncEventIndexPort[] = [],
  ) {}

  async pushEvent(params: PushEventParams): Promise<number> {
    const primarySeq = await this.primary.pushEvent(params);
    await Promise.allSettled(this.secondary.map(index => index.pushEvent(params)));
    return primarySeq;
  }

  async pullEvents(routingId: string, sinceSeq: number, limit = 50): Promise<SyncEventIndexRow[]> {
    const settled = await Promise.allSettled([
      this.primary.pullEvents(routingId, sinceSeq, limit),
      ...this.secondary.map(index => index.pullEvents(routingId, sinceSeq, limit)),
    ]);

    const byId = new Map<string, SyncEventIndexRow>();
    for (const result of settled) {
      if (result.status !== 'fulfilled') continue;
      for (const row of result.value) {
        if (row.routing_id === routingId && row.seq > sinceSeq) {
          byId.set(row.id, row);
        }
      }
    }

    return [...byId.values()]
      .sort((a, b) => a.seq - b.seq || a.id.localeCompare(b.id))
      .slice(0, limit);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- src/infrastructure/sync/__tests__/CompositeSyncEventIndex.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/sync/CompositeSyncEventIndex.ts src/infrastructure/sync/__tests__/CompositeSyncEventIndex.test.ts
git commit -m "feat: compose cloud and local peer sync indexes"
```

---

## Phase 5: Tauri Peer Commands

### Task 5: Add Rust Local Peer Command Boundary

**Files:**
- Create: `src-tauri/src/commands/local_peer.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add Rust dependency**

Modify `src-tauri/Cargo.toml` dependencies:

```toml
ureq = { version = "2.12", features = ["json"] }
tiny_http = "0.12"
```

`ureq` already exists in the current project. Add only `tiny_http` for the local server if no existing HTTP server dependency is selected during execution.

- [ ] **Step 2: Create command module**

Create `src-tauri/src/commands/local_peer.rs` with a minimal HTTP-client first implementation:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalPeerConfig {
    pub id: String,
    pub name: String,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    pub enabled: bool,
    #[serde(rename = "sharedToken")]
    pub shared_token: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PeerRowDto {
    pub id: String,
    pub routing_id: String,
    pub routing_type: String,
    pub seq: i64,
    pub event_type: String,
    pub aggregate_type: Option<String>,
    pub aggregate_id: Option<String>,
    pub device_id: String,
    pub checksum: String,
    pub prev_event_id: Option<String>,
    pub payload_enc_b64: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PushEventResponse {
    pub accepted: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PullEventsResponse {
    pub rows: Vec<PeerRowDto>,
}

fn peer_url(peer: &LocalPeerConfig, path: &str) -> Result<String, String> {
    if !peer.enabled {
        return Err("Peer is disabled".to_string());
    }
    if !(peer.base_url.starts_with("http://") || peer.base_url.starts_with("https://")) {
        return Err("Peer URL must start with http:// or https://".to_string());
    }
    Ok(format!("{}/{}", peer.base_url.trim_end_matches('/'), path.trim_start_matches('/')))
}

#[tauri::command]
pub fn local_peer_push_event(peer: LocalPeerConfig, row: PeerRowDto) -> Result<PushEventResponse, String> {
    let url = peer_url(&peer, "/sync/events")?;
    let response = ureq::post(&url)
        .set("authorization", &format!("Bearer {}", peer.shared_token))
        .send_json(serde_json::json!({ "row": row }))
        .map_err(|e| format!("Peer push failed: {}", e))?;

    response
        .into_json::<PushEventResponse>()
        .map_err(|e| format!("Peer push response parse failed: {}", e))
}

#[tauri::command]
pub fn local_peer_pull_events(
    peer: LocalPeerConfig,
    routing_id: String,
    since_seq: i64,
    limit: i64,
) -> Result<PullEventsResponse, String> {
    let url = peer_url(
        &peer,
        &format!(
            "/sync/events?routing_id={}&since_seq={}&limit={}",
            routing_id,
            since_seq,
            limit.clamp(1, 100)
        ),
    )?;
    let response = ureq::get(&url)
        .set("authorization", &format!("Bearer {}", peer.shared_token))
        .call()
        .map_err(|e| format!("Peer pull failed: {}", e))?;

    response
        .into_json::<PullEventsResponse>()
        .map_err(|e| format!("Peer pull response parse failed: {}", e))
}
```

- [ ] **Step 3: Register commands**

Modify `src-tauri/src/lib.rs`:

```rust
mod commands;
```

Ensure `commands/mod.rs` exports:

```rust
pub mod local_peer;
```

Add to `tauri::generate_handler![...]`:

```rust
commands::local_peer::local_peer_push_event,
commands::local_peer::local_peer_pull_events,
```

- [ ] **Step 4: Run Rust checks**

Run:

```bash
cd src-tauri && cargo test
```

Expected: Rust tests compile and pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/lib.rs src-tauri/src/commands/local_peer.rs src-tauri/src/commands/mod.rs
git commit -m "feat: add local peer tauri commands"
```

---

## Phase 6: Configuration And Wiring

### Task 6: Wire Composite Index Behind A Feature Flag

**Files:**
- Modify: `src/infrastructure/sync/lazy-sync.ts`
- Create: `src/infrastructure/sync/local-peer/peer-settings.ts`
- Test: `src/infrastructure/sync/local-peer/__tests__/peer-settings.test.ts`

- [ ] **Step 1: Write peer settings test**

Create `src/infrastructure/sync/local-peer/__tests__/peer-settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parsePeerSettings } from '../peer-settings';

describe('peer-settings', () => {
  it('returns disabled settings for empty config', () => {
    expect(parsePeerSettings(null)).toEqual({ enabled: false, peers: [] });
  });

  it('keeps only enabled peers with baseUrl and sharedToken', () => {
    const settings = parsePeerSettings({
      enabled: true,
      peers: [
        { id: 'p1', name: 'Peer 1', baseUrl: 'http://10.0.0.2:8787', enabled: true, sharedToken: 'x' },
        { id: 'p2', name: 'Peer 2', baseUrl: '', enabled: true, sharedToken: 'x' },
      ],
    });

    expect(settings.enabled).toBe(true);
    expect(settings.peers.map(p => p.id)).toEqual(['p1']);
  });
});
```

- [ ] **Step 2: Implement settings parser**

Create `src/infrastructure/sync/local-peer/peer-settings.ts`:

```ts
import { z } from 'zod';
import type { LocalPeerConfig } from './LocalPeerTypes';

const PeerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  baseUrl: z.string().min(1),
  enabled: z.boolean(),
  sharedToken: z.string().min(1),
});

const SettingsSchema = z.object({
  enabled: z.boolean(),
  peers: z.array(PeerSchema),
});

export interface LocalPeerSettings {
  enabled: boolean;
  peers: LocalPeerConfig[];
}

export function parsePeerSettings(value: unknown): LocalPeerSettings {
  const parsed = SettingsSchema.safeParse(value);
  if (!parsed.success || !parsed.data.enabled) {
    return { enabled: false, peers: [] };
  }
  return {
    enabled: true,
    peers: parsed.data.peers.filter(p => p.enabled && p.baseUrl.length > 0 && p.sharedToken.length > 0),
  };
}
```

- [ ] **Step 3: Run settings test**

Run:

```bash
npm test -- src/infrastructure/sync/local-peer/__tests__/peer-settings.test.ts
```

Expected: PASS.

- [ ] **Step 4: Modify `lazy-sync.ts`**

In `createDefaultIndexFactory`, keep Supabase as the primary index. Add a second factory later when persisted peer settings are available. The minimal first wiring should be explicit and off by default:

```ts
import { CompositeSyncEventIndex } from './CompositeSyncEventIndex';
import { TauriLocalPeerClient } from './local-peer/LocalPeerClient';
import { LocalPeerSyncEventIndex } from './local-peer/LocalPeerSyncEventIndex';
import { parsePeerSettings } from './local-peer/peer-settings';
```

Add a helper:

```ts
function createPeerIndexFromRuntimeConfig(primary: SyncEventIndexPort): SyncEventIndexPort {
  const raw = typeof window !== 'undefined'
    ? JSON.parse(window.localStorage.getItem('ecoforms.localPeerSync') ?? 'null')
    : null;
  const settings = parsePeerSettings(raw);
  if (!settings.enabled || settings.peers.length === 0) return primary;
  const peerIndex = new LocalPeerSyncEventIndex(settings.peers, new TauriLocalPeerClient());
  return new CompositeSyncEventIndex(primary, [peerIndex]);
}
```

Then wrap the Supabase index:

```ts
const supabaseIndex = createSupabaseSyncEventIndex({
  rpc: async (fn, params) => {
    const { data, error } = await supabase.rpc(fn, params);
    return { data, error };
  },
});
return createPeerIndexFromRuntimeConfig(supabaseIndex);
```

- [ ] **Step 5: Run targeted tests**

Run:

```bash
npm test -- src/infrastructure/sync/__tests__/CompositeSyncEventIndex.test.ts src/infrastructure/sync/local-peer/__tests__/peer-settings.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/sync/lazy-sync.ts src/infrastructure/sync/local-peer/peer-settings.ts src/infrastructure/sync/local-peer/__tests__/peer-settings.test.ts
git commit -m "feat: wire local peer sync behind config"
```

---

## Phase 7: Security Hardening Before Production

### Task 7: Add Device Authentication Plan Before Enabling By Default

**Files:**
- Modify: `docs/adr/ADR-077-p2p-local-sync-sem-lan.md`
- Create: `docs/security/p2p-local-sync-threat-model.md`

- [ ] **Step 1: Create threat model**

Create `docs/security/p2p-local-sync-threat-model.md`:

```markdown
# P2P Local Sync Threat Model

## Assets

- Sync encryption key.
- Device identity.
- Event sequence per routing id.
- SQLite business data after inbound handlers apply events.

## Trust Boundaries

- Webview to Tauri IPC.
- Desktop to local network peer.
- Local peer transport to `InboundService`.

## Required Controls Before Default Enablement

- Peer pairing token must be generated by an authenticated admin.
- Tauri peer commands must reject disabled peers and malformed URLs.
- Inbound application must remain inside `InboundService`.
- P2P must transport encrypted event rows only.
- Device signing with Ed25519 must be implemented before using P2P in untrusted networks.
- Existing arbitrary LAN file commands must not be used by this feature.

## Explicit Non-Goals

- No SQLite file replication.
- No Google Drive mounted-folder event queue.
- No direct JSON snapshot ingestion into `usuarios`, `tarefas`, `demandas`, or other business tables.
```

- [ ] **Step 2: Update ADR status**

Change `ADR-077` status from `Proposto` to `Aceito para protótipo controlado`, and add:

```markdown
## Gate de produção

O recurso só pode ser habilitado por padrão depois de existir autenticação forte de dispositivo, preferencialmente assinatura Ed25519 por device, além de correções nos achados críticos de IPC/FS apontados na auditoria de segurança de 2026-06-19.
```

- [ ] **Step 3: Commit**

```bash
git add docs/adr/ADR-077-p2p-local-sync-sem-lan.md docs/security/p2p-local-sync-threat-model.md
git commit -m "docs: define p2p sync security gate"
```

---

## Phase 8: Verification

### Task 8: Run Full Verification

**Files:**
- No source edits.

- [ ] **Step 1: Run TypeScript tests**

Run:

```bash
npm test
```

Expected: all Vitest tests pass.

- [ ] **Step 2: Run TypeScript compile check**

Run:

```bash
npx tsc --noEmit
```

Expected: no TypeScript errors introduced by the P2P plan implementation.

- [ ] **Step 3: Run Rust tests**

Run:

```bash
cd src-tauri && cargo test
```

Expected: Rust tests compile and pass.

- [ ] **Step 4: Run app build**

Run:

```bash
npm run build
```

Expected: Next.js build succeeds.

- [ ] **Step 5: Commit verification fixes if needed**

If verification requires fixes, commit them separately:

```bash
git add <changed-files>
git commit -m "fix: stabilize p2p local sync verification"
```

---

## Operational Rollout

1. Enable only for an internal pilot with two desktops on the same subnet.
2. Configure peers manually by IP and token.
3. Keep Supabase/backend enabled.
4. Observe sync history, queue size, gap records, and duplicate handling.
5. Disable legacy LAN snapshot pull for pilot users unless there is a specific migration need.
6. Add automatic discovery only after manual peer sync is proven stable.
7. Add Google Workspace API relay only if business requirements need cloud relay separate from Supabase.

## Acceptance Criteria

- A desktop can push encrypted sync events to another configured desktop without a shared LAN folder.
- A desktop can pull peer events and apply them through `InboundService`.
- Backend/Supabase sync still works with P2P disabled.
- Peer failures do not block backend sync.
- Duplicate events from backend and peers are deduplicated by event id.
- No P2P path writes directly into business tables.
- No Google Drive mounted folder is required.

## Explicit Follow-Up Plans

- Device identity and Ed25519 signing.
- Local peer server lifecycle and admin UI.
- Peer discovery via mDNS or manual QR pairing.
- Google Workspace API relay, if required after backend/cloud strategy is decided.
- Removal or quarantine of unsafe LAN snapshot ingestion.

