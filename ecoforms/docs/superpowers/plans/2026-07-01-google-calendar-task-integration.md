# Google Calendar Integration â€” Tasks Module â€” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar automaticamente, na agenda Google do usuÃ¡rio logado, as tarefas a ele atribuÃ­das â€” criando, atualizando e cancelando eventos para espelhar o estado da tarefa (lembrete pessoal, cliente-side).

**Architecture:** Event-driven com outbox local (approach A) + reconciler periÃ³dico (approach C). DomÃ­nio `Task` intocado. Novo mÃ³dulo `application/calendar` orquestra intenÃ§Ãµes; adapters em `infrastructure/calendar` falam com o Google; duas tabelas SQLite (`calendar_outbox`, `task_calendar_projection`) dÃ£o persistÃªncia/idempotÃªncia.

**Tech Stack:** TypeScript, vitest, Next.js (UI), Tauri v2 (desktop runtime), SQLite (via `SqlitePort`/`db_execute` bootstrap), Google Calendar API v3 (REST), OAuth 2.0 loopback com PKCE/state, comandos Tauri em Rust para abrir browser/listener loopback/secret store, keychain do SO via Rust.

**Spec:** `docs/superpowers/specs/2026-07-01-google-calendar-task-integration-design.md`

## Global Constraints

- **DomÃ­nio `Task` intocado** â€” nada em `src/domain/task` Ã© modificado.
- ConvenÃ§Ãµes do projeto: colunas SQLite em `snake_case`; timestamps via `datetime('now')`; testes em `__tests__/` com vitest; fakes em `src/test/fakes/`; UUIDs via `uuidv7` de `ecoforms-core`.
- `TaskStatus` terminal = `'concluido' | 'cancelado'` (ver `isTerminalStatus` em `domain/task/TaskStatus`).
- Escopo OAuth: `https://www.googleapis.com/auth/calendar.events` (somente eventos). Agenda `primary`.
- Refresh token **nunca** em texto plano no SQLite - vai ao keychain do SO por comando Tauri. Nao importar modulos nativos (`keytar`, `http`, `net`) no bundle Next/browser.
- NÃ£o publica para terceiros, nÃ£o Ã© bidirecional, nÃ£o usa server-side.
- Variavel de ambiente necessaria: `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID` (OAuth client do tipo "Desktop app"). Sem `client_secret`. Nao usar `import.meta.env` neste projeto Next.js.
- Todos os paths deste plano sao relativos a raiz do repositorio atual (`ecoforms/`). Comandos `npm`/`npx` rodam em `desktop/`.
- Antes de executar: usar worktree isolado ou arvore limpa. Se `git status --short` mostrar alteracoes alheias, nao fazer commits por task ate isolar a execucao.

## Revision Guardrails (2026-07-01)

Estes ajustes sao obrigatorios antes de executar as tasks abaixo. Eles corrigem riscos encontrados na revisao do plano contra o codigo atual.

- **Identidade do usuario:** `CurrentUserPort` deve ler a sessao local do desktop/Tauri (`get_session` ou fonte equivalente usada por `AuthContext`), nao apenas Supabase Auth. O login Supabase e non-fatal hoje; usar somente Supabase pode retornar `null` com usuario local autenticado.
- **Refresh de access token:** o drainer nao pode falhar simplesmente por access token ausente/expirado. Introduzir uma porta explicita `TokenRefresher`/`OAuthTokenRefresher` ou mover essa responsabilidade para um metodo `TokenStore.getValidAccessToken(userId)`, usando refresh token e persistindo novo access token.
- **Deduplicacao multi-maquina:** ETag/projection local nao impedem duplicidade quando o mesmo usuario usa duas maquinas. O evento Google deve receber identificador deterministico por task, preferencialmente `extendedProperties.private.ecoformsTaskId` e busca previa por `privateExtendedProperty`, ou a projection deve ser sincronizada entre maquinas. Sem isso, o plano deve assumir duplicidade como risco aceito.
- **Lifecycle global:** o drainer/reconciler deve ser montado em um provider/layout autenticado global. Nao deixar o worker depender da tela de Settings estar aberta.
- **Caminhos reais de mutacao:** antes da Task 10, mapear tambem mutacoes via Kanban/repositories/hooks que alteram `tarefas`. Se algum caminho nao passa pelos use cases listados, ele deve acionar `CalendarIntegrationService` ou ser coberto por reconciler em intervalo curto.
- **OAuth loopback:** comando Rust deve ter timeout/cancelamento e resposta de erro limpa para abandono do fluxo, `state` invalido ou ausencia de `code`.
- **Hash canonico:** usar SHA-256 conforme a spec, nao hash curto nao criptografico. Custo e irrelevante e reduz risco de colisao.
- **Encoding:** este arquivo contem mojibake herdado (`Ã§`, `Ã¡`). Corrigir para UTF-8 em uma alteracao separada, para nao misturar revisao funcional com churn de texto.

## File Structure

**Novos arquivos:**
- `src/application/calendar/ports.ts` â€” portas (`CalendarOutbox`, `CalendarProjection`, `CalendarGateway`, `TokenStore`, `CurrentUserPort`) e tipos (`CalendarOp`, `CalendarOutboxItem`, `CalendarProjectionRow`, `GoogleEvent`).
- `src/application/calendar/TaskToEventMapper.ts` â€” `TaskCalendarSnapshot`, `snapshotFromTask`, `snapshotHash`, `toEvent` (puro).
- `src/application/calendar/CalendarIntegrationService.ts` â€” decide upsert/cancel e enfileira.
- `src/application/calendar/CalendarOutboxDrainer.ts` â€” drena outbox â†’ gateway â†’ projection.
- `src/application/calendar/CalendarReconciler.ts` â€” diferenÃ§as de hash â†’ enqueue; Ã³rfÃ£os â†’ cancel.
- `src/application/calendar/__tests__/*.test.ts` â€” testes unitÃ¡rios.
- `src/infrastructure/persistence/sqlite/SqliteCalendarOutboxRepository.ts` â€” `CalendarOutbox` sobre SQLite.
- `src/infrastructure/persistence/sqlite/SqliteTaskCalendarProjectionRepository.ts` â€” `CalendarProjection` sobre SQLite.
- `src/infrastructure/persistence/sqlite/__tests__/SqliteCalendarOutboxRepository.test.ts`
- `src/infrastructure/persistence/sqlite/__tests__/SqliteTaskCalendarProjectionRepository.test.ts`
- `src/infrastructure/calendar/GoogleCalendarAdapter.ts` â€” `CalendarGateway` (REST v3).
- `src/infrastructure/calendar/GoogleOAuthClient.ts` â€” fluxo loopback + refresh.
- `src/infrastructure/calendar/TauriTokenStore.ts` - `TokenStore` via comandos Tauri (keychain).
- `src/infrastructure/calendar/GoogleOAuthTokenRefresher.ts` - renova access token a partir do refresh token.
- `src/infrastructure/calendar/LocalSessionCurrentUserPort.ts` â€” `CurrentUserPort` via sessao local/Tauri, alinhado ao `AuthContext`.
- `src/interface/hooks/useGoogleCalendar.ts` â€” conectar/desconectar/status; lifecycle do drainer/reconciler.
- `desktop/components/settings/GoogleCalendarSettings.tsx` â€” UI de configuraÃ§Ã£o.
- `migrations/022_calendar_integration.sql` - schema.
- `src-tauri/src/commands/google_calendar.rs` - listener loopback OAuth + secret store no keychain.

**Arquivos modificados:**
- `src/application/task/{CreateTaskUseCase,MoveTaskUseCase,AssignTaskUseCase,ArchiveTaskUseCase,UnarchiveTaskUseCase,DeleteTaskUseCase}.ts` â€” recebem `CalendarIntegrationService` opcional e chamam `onTaskChanged`.
- `src/infrastructure/container.ts` â€” registra novos ports/repos/service; injeta nos use cases; garante tabelas.
- `src-tauri/Cargo.toml`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json` - registrar comandos Google Calendar e dependencias Rust (`open`, `keyring`, `url`, `urlencoding`, `rand`, `base64`, `sha2`, `serde`).

---

## Task 1: Ports, tipos e migration de schema

**Files:**
- Create: `desktop/src/application/calendar/ports.ts`
- Create: `desktop/migrations/022_calendar_integration.sql`

**Interfaces (produzidas aqui, consumidas por todas as tasks seguintes):**
- `CalendarOp = 'upsert' | 'cancel'`
- `CalendarOutboxItem`, `CalendarProjectionRow`, `GoogleEvent`
- `CalendarOutbox.insert({taskId,op,payload,now}): Promise<string>` ; `findPending(now,limit)`; `markInFlight/markDone/markFailed/markDead`
- `CalendarProjection.findByTaskId / upsert(row) / delete(taskId) / listAllTaskIds()`
- `CalendarGateway.upsertEvent(event, existingEventId?, accessToken) / deleteEvent(eventId, accessToken)`
- `TokenStore.getRefreshToken/setRefreshToken/clear/getAccessToken/setAccessToken`
- `TokenRefresher.getValidAccessToken(userId, now): Promise<string | null>` (renova access token usando refresh token quando necessario)
- `CurrentUserPort.getCurrentUserId(): Promise<string|null>`

- [ ] **Step 1: Criar `ports.ts`**

```ts
// src/application/calendar/ports.ts
import type { Task } from '../../domain/task/Task';

export type CalendarOp = 'upsert' | 'cancel';
export type CalendarItemStatus = 'pending' | 'in_flight' | 'done' | 'dead';

export interface CalendarOutboxItem {
    id: string;
    taskId: string;
    op: CalendarOp;
    payload: string; // JSON de TaskCalendarSnapshot
    status: CalendarItemStatus;
    attempts: number;
    lastError: string | null;
    nextRetryAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CalendarProjectionRow {
    taskId: string;
    googleCalendarId: string;
    googleEventId: string;
    etag: string | null;
    lastSyncedHash: string;
    lastSyncedAt: string;
}

export interface GoogleEvent {
    id?: string;
    summary: string;
    description?: string;
    start: { date?: string; dateTime?: string };
    end: { date?: string; dateTime?: string };
    recurrence?: string[];
}

export interface CalendarOutbox {
    insert(input: { taskId: string; op: CalendarOp; payload: string; now: string }): Promise<string>;
    findPending(now: string, limit: number): Promise<CalendarOutboxItem[]>;
    markInFlight(id: string, now: string): Promise<void>;
    markDone(id: string): Promise<void>;
    markFailed(id: string, lastError: string, nextRetryAt: string, now: string): Promise<void>;
    markDead(id: string, lastError: string, now: string): Promise<void>;
}

export interface CalendarProjection {
    findByTaskId(taskId: string): Promise<CalendarProjectionRow | null>;
    upsert(row: CalendarProjectionRow): Promise<void>;
    delete(taskId: string): Promise<void>;
    listAllTaskIds(): Promise<string[]>;
}

export interface CalendarGateway {
    upsertEvent(event: GoogleEvent, existingEventId: string | undefined, accessToken: string): Promise<{ id: string; etag: string | null }>;
    deleteEvent(eventId: string, accessToken: string): Promise<void>;
}

export interface TokenStore {
    getRefreshToken(userId: string): Promise<string | null>;
    setRefreshToken(userId: string, token: string): Promise<void>;
    getAccessToken(userId: string): Promise<string | null>;
    setAccessToken(userId: string, token: string, expiresAtIso: string): Promise<void>;
    clear(userId: string): Promise<void>;
}

export interface TokenRefresher {
    getValidAccessToken(userId: string, now: string): Promise<string | null>;
}

export interface CurrentUserPort {
    getCurrentUserId(): Promise<string | null>;
}

// Reexportado para conveniÃªncia dos consumidores (Task Ã© do domÃ­nio).
export type { Task };
```

- [ ] **Step 2: Criar a migration `022_calendar_integration.sql`**

```sql
-- Migration 022: Google Calendar integration (outbox + projection) â€” espelho de tarefas atribuÃ­das
CREATE TABLE IF NOT EXISTS calendar_outbox (
    id             TEXT PRIMARY KEY,
    task_id        TEXT NOT NULL,
    op             TEXT NOT NULL CHECK (op IN ('upsert','cancel')),
    payload        TEXT NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_flight','done','dead')),
    attempts       INTEGER NOT NULL DEFAULT 0,
    last_error     TEXT,
    next_retry_at  TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_calendar_outbox_drain ON calendar_outbox(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_calendar_outbox_task  ON calendar_outbox(task_id);

CREATE TABLE IF NOT EXISTS task_calendar_projection (
    task_id           TEXT PRIMARY KEY,
    google_calendar_id TEXT NOT NULL,
    google_event_id   TEXT NOT NULL,
    etag              TEXT,
    last_synced_hash  TEXT NOT NULL,
    last_synced_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 3: Verificar tipagem**

Run: `npm run typecheck` (em `desktop/`)
Expected: PASS (sem erros; arquivos novos nÃ£o referenciados ainda).

- [ ] **Step 4: Commit**

```bash
git add desktop/src/application/calendar/ports.ts desktop/migrations/022_calendar_integration.sql
git commit -m "feat(calendar): add ports, types and schema for Google Calendar integration"
```

---

## Task 2: TaskToEventMapper (puro)

**Files:**
- Create: `desktop/src/application/calendar/TaskToEventMapper.ts`
- Test: `desktop/src/application/calendar/__tests__/TaskToEventMapper.test.ts`

**Interfaces:**
- Consumes: `Task` (domain), `GoogleEvent` (Task 1).
- Produces: `TaskCalendarSnapshot`, `snapshotFromTask(task): TaskCalendarSnapshot`, `snapshotHash(snap): Promise<string>`, `toEvent(snap): GoogleEvent | null` (`null` quando sem `prazo`).

- [ ] **Step 1: Escrever o teste (falha)**

```ts
// src/application/calendar/__tests__/TaskToEventMapper.test.ts
import { describe, it, expect } from 'vitest';
import { Task } from '../../../domain/task/Task';
import { snapshotFromTask, snapshotHash, toEvent } from '../TaskToEventMapper';

function buildTask(over: Partial<ConstructorParameters<typeof Task.fromProps>[0]> = {}) {
    return Task.fromProps({
        id: 't1', titulo: 'Coletar roteiro', status: 'a_fazer', prioridade: 'media',
        ordem: 0, criadoPor: 'u1', arquivado: false,
        ...over,
    });
}

describe('TaskToEventMapper', () => {
    it('mapeia prazo unico em evento all-day (end exclusivo +1d)', () => {
        const snap = snapshotFromTask(buildTask({ prazo: '2026-07-10', tipoPrazo: 'unico' }));
        const ev = toEvent(snap)!;
        expect(ev.summary).toBe('Coletar roteiro');
        expect(ev.start.date).toBe('2026-07-10');
        expect(ev.end.date).toBe('2026-07-11');
        expect(ev.recurrence).toBeUndefined();
    });

    it('mapeia periodo em all-day multi-dia', () => {
        const snap = snapshotFromTask(buildTask({ prazo: '2026-07-10', prazoFim: '2026-07-12', tipoPrazo: 'periodo' }));
        const ev = toEvent(snap)!;
        expect(ev.start.date).toBe('2026-07-10');
        expect(ev.end.date).toBe('2026-07-13');
    });

    it('mapeia recorrente em recurrence RRULE', () => {
        const snap = snapshotFromTask(buildTask({ prazo: '2026-07-10', tipoPrazo: 'recorrente', recorrencia: 'FREQ=WEEKLY;BYDAY=MO' }));
        const ev = toEvent(snap)!;
        expect(ev.start.date).toBe('2026-07-10');
        expect(ev.end.date).toBe('2026-07-11');
        expect(ev.recurrence).toEqual(['RRULE:FREQ=WEEKLY;BYDAY=MO']);
    });

    it('envolve a recorrencia em RRULE se vier sem prefixo', () => {
        const snap = snapshotFromTask(buildTask({ prazo: '2026-07-10', tipoPrazo: 'recorrente', recorrencia: 'FREQ=DAILY' }));
        expect(toEvent(snap)!.recurrence).toEqual(['RRULE:FREQ=DAILY']);
    });

    it('retorna null quando nao ha prazo', () => {
        const snap = snapshotFromTask(buildTask({ prazo: null, tipoPrazo: null }));
        expect(toEvent(snap)).toBeNull();
    });

    it('snapshotHash e estavel e distinto', () => {
        const a = snapshotFromTask(buildTask({ titulo: 'A', prazo: '2026-07-10', tipoPrazo: 'unico' }));
        const b = snapshotFromTask(buildTask({ titulo: 'A', prazo: '2026-07-10', tipoPrazo: 'unico' }));
        const c = snapshotFromTask(buildTask({ titulo: 'B', prazo: '2026-07-10', tipoPrazo: 'unico' }));
        await expect(snapshotHash(a)).resolves.toBe(await snapshotHash(b));
        expect(await snapshotHash(a)).not.toBe(await snapshotHash(c));
    });

    it('inclui descricao no snapshot e no evento', () => {
        const snap = snapshotFromTask(buildTask({ titulo: 'X', descricao: 'detalhe', prazo: '2026-07-10', tipoPrazo: 'unico' }));
        expect(toEvent(snap)!.description).toBe('detalhe');
    });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/application/calendar/__tests__/TaskToEventMapper.test.ts`
Expected: FAIL â€” mÃ³dulo nÃ£o encontrado / `snapshotFromTask` indefinido.

- [ ] **Step 3: Implementar**

```ts
// src/application/calendar/TaskToEventMapper.ts
import { addDays, format, parseISO } from 'date-fns';
import type { Task } from '../../domain/task/Task';
import type { GoogleEvent } from './ports';

export interface TaskCalendarSnapshot {
    titulo: string;
    descricao: string | null;
    prazo: string | null;
    prazoFim: string | null;
    tipoPrazo: 'unico' | 'periodo' | 'recorrente' | null;
    recorrencia: string | null;
}

export function snapshotFromTask(task: Task): TaskCalendarSnapshot {
    const p = task.toProps();
    return {
        titulo: p.titulo,
        descricao: p.descricao ?? null,
        prazo: p.prazo ?? null,
        prazoFim: p.prazoFim ?? null,
        tipoPrazo: p.tipoPrazo ?? null,
        recorrencia: p.recorrencia ?? null,
    };
}

export async function snapshotHash(s: TaskCalendarSnapshot): Promise<string> {
    const input = [s.titulo, s.descricao ?? '', s.prazo ?? '', s.prazoFim ?? '', s.tipoPrazo ?? '', s.recorrencia ?? ''].join('|');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return 'sha256:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function addDayIso(dateIso: string): string {
    return format(addDays(parseISO(dateIso), 1), 'yyyy-MM-dd');
}

function normalizeRRULE(rec: string): string {
    const trimmed = rec.trim();
    return /^RRULE:/i.test(trimmed) ? trimmed : `RRULE:${trimmed}`;
}

export function toEvent(s: TaskCalendarSnapshot): GoogleEvent | null {
    if (!s.prazo) return null;
    const start = s.prazo;
    const end = (s.tipoPrazo === 'periodo' && s.prazoFim) ? addDayIso(s.prazoFim) : addDayIso(s.prazo);
    const event: GoogleEvent = {
        summary: s.titulo,
        description: s.descricao ?? undefined,
        start: { date: start },
        end: { date: end },
    };
    if (s.tipoPrazo === 'recorrente' && s.recorrencia) {
        event.recurrence = [normalizeRRULE(s.recorrencia)];
    }
    return event;
}
```

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/application/calendar/__tests__/TaskToEventMapper.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/application/calendar/TaskToEventMapper.ts desktop/src/application/calendar/__tests__/TaskToEventMapper.test.ts
git commit -m "feat(calendar): add pure TaskToEventMapper with snapshot hash"
```

---

## Task 3: CalendarIntegrationService (enqueue)

**Files:**
- Create: `desktop/src/application/calendar/CalendarIntegrationService.ts`
- Test: `desktop/src/application/calendar/__tests__/CalendarIntegrationService.test.ts`

**Interfaces:**
- Consumes: `Task` (domain), `CalendarOutbox`, `CalendarProjection`, `CurrentUserPort` (Task 1), `snapshotFromTask`, `snapshotHash` (Task 2), `isTerminalStatus` (domain).
- Produces: `class CalendarIntegrationService { onTaskChanged(task, opts?): Promise<void> }`.

- [ ] **Step 1: Escrever o teste (falha)**

```ts
// src/application/calendar/__tests__/CalendarIntegrationService.test.ts
import { describe, it, expect } from 'vitest';
import { Task } from '../../../domain/task/Task';
import { CalendarIntegrationService } from '../CalendarIntegrationService';
import { snapshotFromTask, snapshotHash } from '../TaskToEventMapper';
import type { CalendarOutbox, CalendarOutboxItem, CalendarProjection, CalendarProjectionRow, CurrentUserPort } from '../ports';

class FakeOutbox implements CalendarOutbox {
    inserted: Array<{ taskId: string; op: string; payload: string }> = [];
    async insert(input: { taskId: string; op: 'upsert' | 'cancel'; payload: string }) {
        this.inserted.push(input);
        return 'id-' + this.inserted.length;
    }
    async findPending(): Promise<CalendarOutboxItem[]> { return []; }
    async markInFlight() {} async markDone() {} async markFailed() {} async markDead() {}
}
class FakeProjection implements CalendarProjection {
    store = new Map<string, CalendarProjectionRow>();
    async findByTaskId(taskId: string) { return this.store.get(taskId) ?? null; }
    async upsert(row: CalendarProjectionRow) { this.store.set(row.taskId, row); }
    async delete(taskId: string) { this.store.delete(taskId); }
    async listAllTaskIds() { return [...this.store.keys()]; }
}
function fakeUser(id: string | null): CurrentUserPort { return { getCurrentUserId: async () => id }; }

function buildTask(over: Partial<ConstructorParameters<typeof Task.fromProps>[0]> = {}) {
    return Task.fromProps({
        id: 't1', titulo: 'T', status: 'a_fazer', prioridade: 'media', ordem: 0,
        criadoPor: 'u1', arquivado: false, prazo: '2026-07-10', tipoPrazo: 'unico', ...over,
    });
}

describe('CalendarIntegrationService', () => {
    it('enfileira upsert quando tarefa ativa esta atribuida a mim', async () => {
        const outbox = new FakeOutbox();
        const svc = new CalendarIntegrationService(outbox, new FakeProjection(), fakeUser('me'));
        await svc.onTaskChanged(buildTask({ atribuidoPara: 'me' }), { now: '2026-07-01T00:00:00Z' });
        expect(outbox.inserted).toHaveLength(1);
        expect(outbox.inserted[0].op).toBe('upsert');
    });

    it('e no-op quando nao sou o assignee', async () => {
        const outbox = new FakeOutbox();
        const svc = new CalendarIntegrationService(outbox, new FakeProjection(), fakeUser('me'));
        await svc.onTaskChanged(buildTask({ atribuidoPara: 'other' }), { now: '2026-07-01T00:00:00Z' });
        expect(outbox.inserted).toHaveLength(0);
    });

    it('nao duplica upsert quando o hash nao mudou', async () => {
        const outbox = new FakeOutbox();
        const proj = new FakeProjection();
        const svc = new CalendarIntegrationService(outbox, proj, fakeUser('me'));
        const task = buildTask({ atribuidoPara: 'me' });
        // 1a mutacao: enfileira upsert (sem projection previa)
        await svc.onTaskChanged(task, { now: '2026-07-01T00:00:00Z' });
        expect(outbox.inserted).toHaveLength(1);
        // simula o drainer gravando a projection com o hash ja sincronizado
        const snap = snapshotFromTask(task);
        proj.store.set('t1', { taskId: 't1', googleCalendarId: 'primary', googleEventId: 'e1', etag: null, lastSyncedHash: await snapshotHash(snap), lastSyncedAt: 'x' });
        outbox.inserted.length = 0;
        // 2a mutacao sem mudanca de hash: nao enfileira
        await svc.onTaskChanged(task, { now: '2026-07-01T00:00:00Z' });
        expect(outbox.inserted).toHaveLength(0);
    });

    it('enfileira cancel quando tarefa e arquivada e ja existia projection', async () => {
        const outbox = new FakeOutbox();
        const proj = new FakeProjection();
        proj.store.set('t1', { taskId: 't1', googleCalendarId: 'primary', googleEventId: 'e1', etag: null, lastSyncedHash: 'h', lastSyncedAt: 'x' });
        const svc = new CalendarIntegrationService(outbox, proj, fakeUser('me'));
        await svc.onTaskChanged(buildTask({ atribuidoPara: 'me', arquivado: true }), { now: '2026-07-01T00:00:00Z' });
        expect(outbox.inserted).toHaveLength(1);
        expect(outbox.inserted[0].op).toBe('cancel');
    });

    it('nao enfileira cancel quando nao ha projection previa', async () => {
        const outbox = new FakeOutbox();
        const svc = new CalendarIntegrationService(outbox, new FakeProjection(), fakeUser('me'));
        await svc.onTaskChanged(buildTask({ atribuidoPara: 'me', status: 'concluido' }), { now: '2026-07-01T00:00:00Z' });
        expect(outbox.inserted).toHaveLength(0);
    });

    it('em removed=true enfileira cancel se havia projection', async () => {
        const outbox = new FakeOutbox();
        const proj = new FakeProjection();
        proj.store.set('t1', { taskId: 't1', googleCalendarId: 'primary', googleEventId: 'e1', etag: null, lastSyncedHash: 'h', lastSyncedAt: 'x' });
        const svc = new CalendarIntegrationService(outbox, proj, fakeUser('me'));
        await svc.onTaskChanged(buildTask({ atribuidoPara: 'me' }), { now: '2026-07-01T00:00:00Z', removed: true });
        expect(outbox.inserted[0].op).toBe('cancel');
    });

    it('e no-op quando nao ha usuario logado', async () => {
        const outbox = new FakeOutbox();
        const svc = new CalendarIntegrationService(outbox, new FakeProjection(), fakeUser(null));
        await svc.onTaskChanged(buildTask({ atribuidoPara: 'me' }), { now: '2026-07-01T00:00:00Z' });
        expect(outbox.inserted).toHaveLength(0);
    });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/application/calendar/__tests__/CalendarIntegrationService.test.ts`
Expected: FAIL â€” classe inexistente.

- [ ] **Step 3: Implementar**

```ts
// src/application/calendar/CalendarIntegrationService.ts
import type { Task } from '../../domain/task/Task';
import { isTerminalStatus } from '../../domain/task/TaskStatus';
import type { CalendarOutbox, CalendarProjection, CurrentUserPort } from './ports';
import { snapshotFromTask, snapshotHash } from './TaskToEventMapper';

export interface OnTaskChangedOpts {
    now: string;
    removed?: boolean;
}

export class CalendarIntegrationService {
    constructor(
        private readonly outbox: CalendarOutbox,
        private readonly projection: CalendarProjection,
        private readonly currentUser: CurrentUserPort,
    ) {}

    async onTaskChanged(task: Task, opts: OnTaskChangedOpts): Promise<void> {
        const me = await this.currentUser.getCurrentUserId();
        if (!me) return;

        const isMine = task.atribuidoPara === me;
        const active = !task.arquivado && !isTerminalStatus(task.status);
        const desired = isMine && active && !opts.removed && !!task.prazo;
        const proj = await this.projection.findByTaskId(task.id);

        if (desired) {
            const snap = snapshotFromTask(task);
            const hash = await snapshotHash(snap);
            if (!proj || proj.lastSyncedHash !== hash) {
                await this.outbox.insert({ taskId: task.id, op: 'upsert', payload: JSON.stringify(snap), now: opts.now });
            }
            return;
        }
        if (proj) {
            await this.outbox.insert({ taskId: task.id, op: 'cancel', payload: JSON.stringify(snapshotFromTask(task)), now: opts.now });
        }
    }
}
```

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/application/calendar/__tests__/CalendarIntegrationService.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/application/calendar/CalendarIntegrationService.ts desktop/src/application/calendar/__tests__/CalendarIntegrationService.test.ts
git commit -m "feat(calendar): add CalendarIntegrationService enqueue logic"
```

---

## Task 4: SqliteCalendarOutboxRepository

**Files:**
- Create: `desktop/src/infrastructure/persistence/sqlite/SqliteCalendarOutboxRepository.ts`
- Test: `desktop/src/infrastructure/persistence/sqlite/__tests__/SqliteCalendarOutboxRepository.test.ts`

**Interfaces:**
- Consumes: `SqlitePort` (`query/execute`), `uuidv7` (`ecoforms-core`), `CalendarOutbox`/`CalendarOutboxItem` (Task 1).
- Produces: `class SqliteCalendarOutboxRepository implements CalendarOutbox`.
- PadrÃ£o de teste: `RecordingSqlite` (fake que grava SQL/params), conforme `SqliteKanbanRepository.test.ts`.

- [ ] **Step 1: Escrever o teste (falha)**

```ts
// src/infrastructure/persistence/sqlite/__tests__/SqliteCalendarOutboxRepository.test.ts
import { describe, it, expect } from 'vitest';
import type { SqlitePort } from '../../../../application/ports/SqlitePort';
import { SqliteCalendarOutboxRepository } from '../SqliteCalendarOutboxRepository';

class RecordingSqlite implements SqlitePort {
    readonly calls: Array<{ sql: string; params: unknown[] }> = [];
    private rows = new Map<string, unknown[]>();
    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
        this.calls.push({ sql, params });
        return (this.rows.get(sql) ?? []) as T[];
    }
    async all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> { return this.query<T>(sql, params); }
    async execute(sql: string, params: unknown[] = []): Promise<void> { this.calls.push({ sql, params }); }
    async transaction<T>(cb: (tx: SqlitePort) => Promise<T>): Promise<T> { return cb(this); }
    // helper de teste para simular retorno de findPending
    setRows(sqlSubstr: string, rows: unknown[]) {
        for (const c of this.calls) { if (c.sql.includes(sqlSubstr)) { this.rows.set(c.sql, rows); } }
    }
}

describe('SqliteCalendarOutboxRepository', () => {
    it('insert gera INSERT com payload e status pending', async () => {
        const db = new RecordingSqlite();
        const repo = new SqliteCalendarOutboxRepository(db);
        await repo.insert({ taskId: 't1', op: 'upsert', payload: '{}', now: '2026-07-01T00:00:00Z' });
        const ins = db.calls.find(c => c.sql.startsWith('INSERT INTO calendar_outbox'));
        expect(ins).toBeTruthy();
        expect(ins!.params[1]).toBe('t1');
        expect(ins!.params[2]).toBe('upsert');
        expect(ins!.params[3]).toBe('{}');
    });

    it('findPending usa status e next_retry_at no filtro', async () => {
        const db = new RecordingSqlite();
        const repo = new SqliteCalendarOutboxRepository(db);
        await repo.findPending('2026-07-01T00:00:00Z', 10);
        const sel = db.calls.find(c => c.sql.includes('FROM calendar_outbox'));
        expect(sel).toBeTruthy();
        expect(sel!.params[0]).toBe('2026-07-01T00:00:00Z');
        expect(sel!.params[1]).toBe(10);
        expect(sel!.sql).toContain("status = 'pending'");
    });

    it('markFailed incrementa attempts e define next_retry_at', async () => {
        const db = new RecordingSqlite();
        const repo = new SqliteCalendarOutboxRepository(db);
        await repo.markFailed('id1', 'err', '2026-07-01T00:01:00Z', '2026-07-01T00:00:00Z');
        const upd = db.calls.find(c => c.sql.includes('attempts = attempts + 1'));
        expect(upd).toBeTruthy();
        expect(upd!.params).toContain('err');
    });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/infrastructure/persistence/sqlite/__tests__/SqliteCalendarOutboxRepository.test.ts`
Expected: FAIL â€” classe inexistente.

- [ ] **Step 3: Implementar**

```ts
// src/infrastructure/persistence/sqlite/SqliteCalendarOutboxRepository.ts
import { uuidv7 } from 'ecoforms-core';
import type { CalendarOutbox, CalendarOutboxItem } from '../../../application/calendar/ports';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface OutboxRow {
    id: string; task_id: string; op: 'upsert' | 'cancel'; payload: string;
    status: 'pending' | 'in_flight' | 'done' | 'dead'; attempts: number;
    last_error: string | null; next_retry_at: string | null;
    created_at: string; updated_at: string;
}

function rowToItem(r: OutboxRow): CalendarOutboxItem {
    return {
        id: r.id, taskId: r.task_id, op: r.op, payload: r.payload, status: r.status,
        attempts: r.attempts, lastError: r.last_error, nextRetryAt: r.next_retry_at,
        createdAt: r.created_at, updatedAt: r.updated_at,
    };
}

export class SqliteCalendarOutboxRepository implements CalendarOutbox {
    constructor(private readonly db: SqlitePort) {}

    async insert(input: { taskId: string; op: 'upsert' | 'cancel'; payload: string; now: string }): Promise<string> {
        const id = uuidv7();
        await this.db.execute(
            `INSERT INTO calendar_outbox (id, task_id, op, payload, status, attempts, created_at, updated_at)
             VALUES (?, ?, ?, ?, 'pending', 0, ?, ?)`,
            [id, input.taskId, input.op, input.payload, input.now, input.now],
        );
        return id;
    }

    async findPending(now: string, limit: number): Promise<CalendarOutboxItem[]> {
        const rows = await this.db.query<OutboxRow>(
            `SELECT * FROM calendar_outbox
             WHERE status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= ?)
             ORDER BY created_at ASC LIMIT ?`,
            [now, limit],
        );
        return rows.map(rowToItem);
    }

    async markInFlight(id: string, now: string): Promise<void> {
        await this.db.execute(
            `UPDATE calendar_outbox SET status = 'in_flight', updated_at = ? WHERE id = ?`,
            [now, id],
        );
    }

    async markDone(id: string): Promise<void> {
        await this.db.execute(
            `UPDATE calendar_outbox SET status = 'done', updated_at = datetime('now') WHERE id = ?`,
            [id],
        );
    }

    async markFailed(id: string, lastError: string, nextRetryAt: string, now: string): Promise<void> {
        await this.db.execute(
            `UPDATE calendar_outbox
             SET status = 'pending', attempts = attempts + 1, last_error = ?, next_retry_at = ?, updated_at = ?
             WHERE id = ?`,
            [lastError, nextRetryAt, now, id],
        );
    }

    async markDead(id: string, lastError: string, now: string): Promise<void> {
        await this.db.execute(
            `UPDATE calendar_outbox SET status = 'dead', last_error = ?, updated_at = ? WHERE id = ?`,
            [lastError, now, id],
        );
    }
}
```

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/infrastructure/persistence/sqlite/__tests__/SqliteCalendarOutboxRepository.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/infrastructure/persistence/sqlite/SqliteCalendarOutboxRepository.ts desktop/src/infrastructure/persistence/sqlite/__tests__/SqliteCalendarOutboxRepository.test.ts
git commit -m "feat(calendar): add SqliteCalendarOutboxRepository"
```

---

## Task 5: SqliteTaskCalendarProjectionRepository

**Files:**
- Create: `desktop/src/infrastructure/persistence/sqlite/SqliteTaskCalendarProjectionRepository.ts`
- Test: `desktop/src/infrastructure/persistence/sqlite/__tests__/SqliteTaskCalendarProjectionRepository.test.ts`

**Interfaces:**
- Consumes: `SqlitePort`, `CalendarProjection`/`CalendarProjectionRow` (Task 1).
- Produces: `class SqliteTaskCalendarProjectionRepository implements CalendarProjection`.

- [ ] **Step 1: Escrever o teste (falha)**

```ts
// src/infrastructure/persistence/sqlite/__tests__/SqliteTaskCalendarProjectionRepository.test.ts
import { describe, it, expect } from 'vitest';
import type { SqlitePort } from '../../../../application/ports/SqlitePort';
import { SqliteTaskCalendarProjectionRepository } from '../SqliteTaskCalendarProjectionRepository';

class RecordingSqlite implements SqlitePort {
    readonly calls: Array<{ sql: string; params: unknown[] }> = [];
    private rows: unknown[] = [];
    async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> { this.calls.push({ sql, params }); return this.rows as T[]; }
    async all<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> { return this.query<T>(sql, params); }
    async execute(sql: string, params: unknown[] = []): Promise<void> { this.calls.push({ sql, params }); }
    async transaction<T>(cb: (tx: SqlitePort) => Promise<T>): Promise<T> { return cb(this); }
    setRows(rows: unknown[]) { this.rows = rows; }
}

const row = { taskId: 't1', googleCalendarId: 'primary', googleEventId: 'e1', etag: '"v1"', lastSyncedHash: 'h', lastSyncedAt: '2026-07-01' };

describe('SqliteTaskCalendarProjectionRepository', () => {
    it('findByTaskId mapeia colunas snake_case para camelCase', async () => {
        const db = new RecordingSqlite();
        db.setRows([{ task_id: 't1', google_calendar_id: 'primary', google_event_id: 'e1', etag: '"v1"', last_synced_hash: 'h', last_synced_at: '2026-07-01' }]);
        const repo = new SqliteTaskCalendarProjectionRepository(db);
        const got = await repo.findByTaskId('t1');
        expect(got).toEqual(row);
    });

    it('upsert emite INSERT OR REPLACE com task_id como chave', async () => {
        const db = new RecordingSqlite();
        const repo = new SqliteTaskCalendarProjectionRepository(db);
        await repo.upsert(row);
        const ins = db.calls.find(c => c.sql.includes('INSERT OR REPLACE INTO task_calendar_projection'));
        expect(ins).toBeTruthy();
        expect(ins!.params[0]).toBe('t1');
        expect(ins!.params[2]).toBe('e1');
    });

    it('delete emite DELETE por task_id', async () => {
        const db = new RecordingSqlite();
        const repo = new SqliteTaskCalendarProjectionRepository(db);
        await repo.delete('t1');
        const del = db.calls.find(c => c.sql.startsWith('DELETE FROM task_calendar_projection'));
        expect(del).toBeTruthy();
        expect(del!.params[0]).toBe('t1');
    });

    it('listAllTaskIds emite SELECT de task_id', async () => {
        const db = new RecordingSqlite();
        db.setRows([{ task_id: 't1' }, { task_id: 't2' }]);
        const repo = new SqliteTaskCalendarProjectionRepository(db);
        const ids = await repo.listAllTaskIds();
        expect(ids).toEqual(['t1', 't2']);
        const sel = db.calls.find(c => c.sql.includes('SELECT task_id FROM task_calendar_projection'));
        expect(sel).toBeTruthy();
    });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/infrastructure/persistence/sqlite/__tests__/SqliteTaskCalendarProjectionRepository.test.ts`
Expected: FAIL â€” classe inexistente.

- [ ] **Step 3: Implementar**

```ts
// src/infrastructure/persistence/sqlite/SqliteTaskCalendarProjectionRepository.ts
import type { CalendarProjection, CalendarProjectionRow } from '../../../application/calendar/ports';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface ProjRow {
    task_id: string; google_calendar_id: string; google_event_id: string;
    etag: string | null; last_synced_hash: string; last_synced_at: string;
}

export class SqliteTaskCalendarProjectionRepository implements CalendarProjection {
    constructor(private readonly db: SqlitePort) {}

    async findByTaskId(taskId: string): Promise<CalendarProjectionRow | null> {
        const rows = await this.db.query<ProjRow>(
            `SELECT * FROM task_calendar_projection WHERE task_id = ? LIMIT 1`,
            [taskId],
        );
        if (rows.length === 0) return null;
        const r = rows[0];
        return {
            taskId: r.task_id, googleCalendarId: r.google_calendar_id, googleEventId: r.google_event_id,
            etag: r.etag, lastSyncedHash: r.last_synced_hash, lastSyncedAt: r.last_synced_at,
        };
    }

    async upsert(row: CalendarProjectionRow): Promise<void> {
        await this.db.execute(
            `INSERT OR REPLACE INTO task_calendar_projection
             (task_id, google_calendar_id, google_event_id, etag, last_synced_hash, last_synced_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [row.taskId, row.googleCalendarId, row.googleEventId, row.etag, row.lastSyncedHash, row.lastSyncedAt],
        );
    }

    async delete(taskId: string): Promise<void> {
        await this.db.execute(`DELETE FROM task_calendar_projection WHERE task_id = ?`, [taskId]);
    }

    async listAllTaskIds(): Promise<string[]> {
        const rows = await this.db.query<{ task_id: string }>(`SELECT task_id FROM task_calendar_projection`, []);
        return rows.map(r => r.task_id);
    }
}
```

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/infrastructure/persistence/sqlite/__tests__/SqliteTaskCalendarProjectionRepository.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/infrastructure/persistence/sqlite/SqliteTaskCalendarProjectionRepository.ts desktop/src/infrastructure/persistence/sqlite/__tests__/SqliteTaskCalendarProjectionRepository.test.ts
git commit -m "feat(calendar): add SqliteTaskCalendarProjectionRepository"
```

---

## Task 6: CalendarOutboxDrainer

**Files:**
- Create: `desktop/src/application/calendar/CalendarOutboxDrainer.ts`
- Test: `desktop/src/application/calendar/__tests__/CalendarOutboxDrainer.test.ts`

**Interfaces:**
- Consumes: `CalendarOutbox`, `CalendarProjection`, `CalendarGateway`, `TokenRefresher`, `CurrentUserPort` (Task 1); `toEvent`, `snapshotHash`, `TaskCalendarSnapshot` (Task 2).
- Produces: `class CalendarOutboxDrainer { drainOnce(opts): Promise<DrainStats> }` e helper `backoffSeconds(attempts)`.

- [ ] **Step 1: Escrever o teste (falha)**

```ts
// src/application/calendar/__tests__/CalendarOutboxDrainer.test.ts
import { describe, it, expect } from 'vitest';
import { CalendarOutboxDrainer, backoffSeconds } from '../CalendarOutboxDrainer';
import type { CalendarGateway, CalendarOutbox, CalendarOutboxItem, CalendarProjection, CurrentUserPort, GoogleEvent, TokenRefresher } from '../ports';

class FakeOutbox implements CalendarOutbox {
    pending: CalendarOutboxItem[] = [];
    done: string[] = []; failed: string[] = []; dead: string[] = [];
    async insert() { return 'x'; }
    async findPending() { return this.pending; }
    async markInFlight(id: string) { const it = this.pending.find(i => i.id === id); if (it) it.status = 'in_flight'; }
    async markDone(id: string) { this.done.push(id); }
    async markFailed(id: string) { this.failed.push(id); }
    async markDead(id: string) { this.dead.push(id); }
}
class FakeGateway implements CalendarGateway {
    upserts: GoogleEvent[] = []; deletes: string[] = []; failWith?: (e: Error) => void;
    async upsertEvent(e: GoogleEvent) { if (this.failWith) throw this.failWith(new Error('boom')); this.upserts.push(e); return { id: 'evt-' + (this.upserts.length), etag: '"e"' }; }
    async deleteEvent(id: string) { if (this.failWith) throw this.failWith(new Error('boom')); this.deletes.push(id); }
}
class FakeTokenRefresher implements TokenRefresher {
    access: string | null = 'a';
    async getValidAccessToken() { return this.access; }
}
function fakeUser(id: string | null): CurrentUserPort { return { getCurrentUserId: async () => id }; }

function item(over: Partial<CalendarOutboxItem> = {}): CalendarOutboxItem {
    return { id: 'i1', taskId: 't1', op: 'upsert', payload: JSON.stringify({ titulo: 'T', descricao: null, prazo: '2026-07-10', prazoFim: null, tipoPrazo: 'unico', recorrencia: null }), status: 'pending', attempts: 0, lastError: null, nextRetryAt: null, createdAt: 'x', updatedAt: 'x', ...over };
}

describe('CalendarOutboxDrainer', () => {
    it('upsert cria evento e grava projection', async () => {
        const outbox = new FakeOutbox(); outbox.pending = [item()];
        const proj = { findByTaskId: async () => null, upsert: async () => {}, delete: async () => {}, listAllTaskIds: async () => [] } as CalendarProjection;
        const drainer = new CalendarOutboxDrainer(outbox, proj, new FakeGateway(), new FakeTokenRefresher(), fakeUser('me'));
        const stats = await drainer.drainOnce({ now: '2026-07-01T00:00:00Z' });
        expect(stats.succeeded).toBe(1);
        expect(outbox.done).toEqual(['i1']);
    });

    it('cancel remove evento existente da projection', async () => {
        const outbox = new FakeOutbox(); outbox.pending = [item({ op: 'cancel' })];
        const gw = new FakeGateway();
        const proj = { findByTaskId: async () => ({ taskId: 't1', googleCalendarId: 'primary', googleEventId: 'evt-9', etag: null, lastSyncedHash: 'h', lastSyncedAt: 'x' }), upsert: async () => {}, delete: async () => {}, listAllTaskIds: async () => ['t1'] } as unknown as CalendarProjection;
        const drainer = new CalendarOutboxDrainer(outbox, proj, gw, new FakeTokenRefresher(), fakeUser('me'));
        await drainer.drainOnce({ now: '2026-07-01T00:00:00Z' });
        expect(gw.deletes).toEqual(['evt-9']);
        expect(outbox.done).toEqual(['i1']);
    });

    it('cancel sem projection e idempotente (done)', async () => {
        const outbox = new FakeOutbox(); outbox.pending = [item({ op: 'cancel' })];
        const proj = { findByTaskId: async () => null, upsert: async () => {}, delete: async () => {}, listAllTaskIds: async () => [] } as CalendarProjection;
        const drainer = new CalendarOutboxDrainer(outbox, proj, new FakeGateway(), new FakeTokenRefresher(), fakeUser('me'));
        await drainer.drainOnce({ now: '2026-07-01T00:00:00Z' });
        expect(outbox.done).toEqual(['i1']);
    });

    it('falha transitoria marca failed (nao dead) e incrementa', async () => {
        const outbox = new FakeOutbox(); const it = item({ attempts: 0 }); outbox.pending = [it];
        const gw = new FakeGateway(); gw.failWith = (e) => { (e as Error & { status?: number }).status = 500; return e; };
        const proj = { findByTaskId: async () => null, upsert: async () => {}, delete: async () => {}, listAllTaskIds: async () => [] } as CalendarProjection;
        const drainer = new CalendarOutboxDrainer(outbox, proj, gw, new FakeTokenRefresher(), fakeUser('me'));
        await drainer.drainOnce({ now: '2026-07-01T00:00:00Z' });
        expect(outbox.failed).toEqual(['i1']);
        expect(outbox.dead).toHaveLength(0);
    });

    it('atingir 8 tentativas marca dead', async () => {
        const outbox = new FakeOutbox(); outbox.pending = [item({ attempts: 7 })];
        const gw = new FakeGateway(); gw.failWith = (e) => { (e as Error & { status?: number }).status = 500; return e; };
        const proj = { findByTaskId: async () => null, upsert: async () => {}, delete: async () => {}, listAllTaskIds: async () => [] } as CalendarProjection;
        const drainer = new CalendarOutboxDrainer(outbox, proj, gw, new FakeTokenRefresher(), fakeUser('me'));
        await drainer.drainOnce({ now: '2026-07-01T00:00:00Z' });
        expect(outbox.dead).toEqual(['i1']);
    });

    it('sem token valido marca failed (espera conexao)', async () => {
        const outbox = new FakeOutbox(); outbox.pending = [item()];
        const tokens = new FakeTokenRefresher(); tokens.access = null;
        const proj = { findByTaskId: async () => null, upsert: async () => {}, delete: async () => {}, listAllTaskIds: async () => [] } as CalendarProjection;
        const drainer = new CalendarOutboxDrainer(outbox, proj, new FakeGateway(), tokens, fakeUser('me'));
        await drainer.drainOnce({ now: '2026-07-01T00:00:00Z' });
        expect(outbox.failed).toEqual(['i1']);
    });

    it('backoffSeconds cresce e trunca em 3600', () => {
        expect(backoffSeconds(1)).toBe(30);
        expect(backoffSeconds(2)).toBeGreaterThan(backoffSeconds(1));
        expect(backoffSeconds(99)).toBeLessThanOrEqual(3600);
    });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/application/calendar/__tests__/CalendarOutboxDrainer.test.ts`
Expected: FAIL â€” classe inexistente.

- [ ] **Step 3: Implementar**

```ts
// src/application/calendar/CalendarOutboxDrainer.ts
import type { CalendarGateway, CalendarOutbox, CalendarProjection, CurrentUserPort, TokenRefresher } from './ports';
import { snapshotHash, toEvent } from './TaskToEventMapper';
import type { TaskCalendarSnapshot } from './TaskToEventMapper';

const MAX_ATTEMPTS = 8;

export interface DrainOpts { now: string; limit?: number; }
export interface DrainStats { processed: number; succeeded: number; failed: number; dead: number; }

export function backoffSeconds(attempts: number): number {
    const table = [30, 60, 300, 900, 1800, 3600, 3600, 3600];
    return table[Math.min(attempts, table.length - 1)];
}

function isStatusError(err: unknown, status: number): boolean {
    return typeof err === 'object' && err !== null && (err as { status?: number }).status === status;
}
function addSecondsIso(iso: string, seconds: number): string {
    return new Date(Date.parse(iso) + seconds * 1000).toISOString();
}

export class CalendarOutboxDrainer {
    constructor(
        private readonly outbox: CalendarOutbox,
        private readonly projection: CalendarProjection,
        private readonly gateway: CalendarGateway,
        private readonly tokenRefresher: TokenRefresher,
        private readonly currentUser: CurrentUserPort,
    ) {}

    async drainOnce(opts: DrainOpts): Promise<DrainStats> {
        const items = await this.outbox.findPending(opts.now, opts.limit ?? 10);
        const stats = { processed: 0, succeeded: 0, failed: 0, dead: 0 };
        for (const it of items) {
            stats.processed++;
            await this.outbox.markInFlight(it.id, opts.now);
            try {
                await this.process(it, opts.now);
                await this.outbox.markDone(it.id);
                stats.succeeded++;
            } catch (err) {
                const nextAttempts = it.attempts + 1;
                const msg = err instanceof Error ? err.message : String(err);
                if (nextAttempts >= MAX_ATTEMPTS) {
                    await this.outbox.markDead(it.id, msg, opts.now);
                    stats.dead++;
                } else {
                    await this.outbox.markFailed(it.id, msg, addSecondsIso(opts.now, backoffSeconds(nextAttempts)), opts.now);
                    stats.failed++;
                }
            }
        }
        return stats;
    }

    private async process(it: { id: string; taskId: string; op: 'upsert' | 'cancel'; payload: string }, now: string): Promise<void> {
        const me = await this.currentUser.getCurrentUserId();
        if (!me) throw new Error('no-current-user');
        const access = await this.tokenRefresher.getValidAccessToken(me, now);
        if (!access) throw new Error('not-connected');

        if (it.op === 'upsert') {
            const snap = JSON.parse(it.payload) as TaskCalendarSnapshot;
            const event = toEvent(snap);
            const proj = await this.projection.findByTaskId(it.taskId);
            if (!event) {
                if (proj) await this.projection.delete(it.taskId);
                return;
            }
            const res = await this.gateway.upsertEvent(event, proj?.googleEventId, access);
            await this.projection.upsert({
                taskId: it.taskId, googleCalendarId: 'primary', googleEventId: res.id,
                etag: res.etag, lastSyncedHash: await snapshotHash(snap), lastSyncedAt: now,
            });
            return;
        }
        // cancel
        const proj = await this.projection.findByTaskId(it.taskId);
        if (!proj) return;
        try {
            await this.gateway.deleteEvent(proj.googleEventId, access);
        } catch (err) {
            if (!isStatusError(err, 404)) throw err;
        }
        await this.projection.delete(it.taskId);
    }
}
```

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/application/calendar/__tests__/CalendarOutboxDrainer.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/application/calendar/CalendarOutboxDrainer.ts desktop/src/application/calendar/__tests__/CalendarOutboxDrainer.test.ts
git commit -m "feat(calendar): add CalendarOutboxDrainer with backoff and idempotency"
```

---

## Task 7: CalendarReconciler

**Files:**
- Create: `desktop/src/application/calendar/CalendarReconciler.ts`
- Test: `desktop/src/application/calendar/__tests__/CalendarReconciler.test.ts`

**Interfaces:**
- Consumes: `TaskRepository` (domain), `CalendarProjection`, `CalendarOutbox`, `CurrentUserPort` (Task 1); `snapshotFromTask`, `snapshotHash` (Task 2); `isTerminalStatus` (domain).
- Produces: `class CalendarReconciler { reconcile(opts): Promise<ReconcileStats> }`. **SÃ³ enfileira; nunca chama o Google.**

- [ ] **Step 1: Escrever o teste (falha)**

```ts
// src/application/calendar/__tests__/CalendarReconciler.test.ts
import { describe, it, expect } from 'vitest';
import { Task } from '../../../domain/task/Task';
import { CalendarReconciler } from '../CalendarReconciler';
import { snapshotHash, snapshotFromTask } from '../TaskToEventMapper';
import type { CalendarOutbox, CalendarProjection, CalendarProjectionRow, CurrentUserPort } from '../ports';
import { InMemoryTaskRepository } from '../../../test/fakes/InMemoryTaskRepository';

class SpyOutbox implements CalendarOutbox {
    enqueued: Array<{ taskId: string; op: string }> = [];
    async insert(i: { taskId: string; op: 'upsert' | 'cancel' }) { this.enqueued.push(i); return 'x'; }
    async findPending() { return []; } async markInFlight() {} async markDone() {} async markFailed() {} async markDead() {}
}
function fakeUser(id: string | null): CurrentUserPort { return { getCurrentUserId: async () => id }; }

function mk(over: Partial<ConstructorParameters<typeof Task.fromProps>[0]> = {}) {
    return Task.fromProps({ id: 't1', titulo: 'T', status: 'a_fazer', prioridade: 'media', ordem: 0, criadoPor: 'u', arquivado: false, prazo: '2026-07-10', tipoPrazo: 'unico', atribuidoPara: 'me', ...over });
}
function proj(taskId: string, hash: string): CalendarProjectionRow {
    return { taskId, googleCalendarId: 'primary', googleEventId: 'e', etag: null, lastSyncedHash: hash, lastSyncedAt: 'x' };
}

describe('CalendarReconciler', () => {
    it('enfileira upsert quando hash diverge', async () => {
        const tasks = new InMemoryTaskRepository();
        const t = mk(); await tasks.save(t);
        const spy = new SpyOutbox();
        const projStore = new Map<string, CalendarProjectionRow>([['t1', proj('t1', 'stale')]]);
        const projection: CalendarProjection = { findByTaskId: async id => projStore.get(id) ?? null, upsert: async r => projStore.set(r.taskId, r), delete: async id => projStore.delete(id), listAllTaskIds: async () => [...projStore.keys()] };
        const r = new CalendarReconciler(tasks, projection, spy, fakeUser('me'));
        const stats = await r.reconcile({ now: '2026-07-01T00:00:00Z' });
        expect(spy.enqueued.some(e => e.taskId === 't1' && e.op === 'upsert')).toBe(true);
        expect(stats.enqueued).toBeGreaterThanOrEqual(1);
    });

    it('nao enfileira quando hash coincide', async () => {
        const tasks = new InMemoryTaskRepository();
        const t = mk(); await tasks.save(t);
        const correct = await snapshotHash(snapshotFromTask(t));
        const spy = new SpyOutbox();
        const projStore = new Map<string, CalendarProjectionRow>([['t1', proj('t1', correct)]]);
        const projection: CalendarProjection = { findByTaskId: async id => projStore.get(id) ?? null, upsert: async r => projStore.set(r.taskId, r), delete: async id => projStore.delete(id), listAllTaskIds: async () => [...projStore.keys()] };
        await new CalendarReconciler(tasks, projection, spy, fakeUser('me')).reconcile({ now: '2026-07-01T00:00:00Z' });
        expect(spy.enqueued).toHaveLength(0);
    });

    it('enfileira cancel para projection orfa (task nao ativa para mim)', async () => {
        const tasks = new InMemoryTaskRepository();
        const spy = new SpyOutbox();
        const projStore = new Map<string, CalendarProjectionRow>([['orphan', proj('orphan', 'h')]]);
        const projection: CalendarProjection = { findByTaskId: async id => projStore.get(id) ?? null, upsert: async r => projStore.set(r.taskId, r), delete: async id => projStore.delete(id), listAllTaskIds: async () => [...projStore.keys()] };
        await new CalendarReconciler(tasks, projection, spy, fakeUser('me')).reconcile({ now: '2026-07-01T00:00:00Z' });
        expect(spy.enqueued.some(e => e.taskId === 'orphan' && e.op === 'cancel')).toBe(true);
    });

    it('e no-op sem usuario logado', async () => {
        const tasks = new InMemoryTaskRepository();
        const spy = new SpyOutbox();
        const projection: CalendarProjection = { findByTaskId: async () => null, upsert: async () => {}, delete: async () => {}, listAllTaskIds: async () => [] };
        const stats = await new CalendarReconciler(tasks, projection, spy, fakeUser(null)).reconcile({ now: '2026-07-01T00:00:00Z' });
        expect(stats.enqueued).toBe(0);
        expect(spy.enqueued).toHaveLength(0);
    });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/application/calendar/__tests__/CalendarReconciler.test.ts`
Expected: FAIL â€” classe inexistente.

> **Nota de implementaÃ§Ã£o:** `CalendarReconciler` precisa listar tasks atribuÃ­das ao usuÃ¡rio. `TaskRepository` nÃ£o tem `findAllAssignedTo(userId)`, entÃ£o use `query({ assignedTo: me, includeArchived: true })` (jÃ¡ existe) e filtre arquivadas/terminais em memÃ³ria. Para projeÃ§Ãµes Ã³rfÃ£s, use `CalendarProjection.listAllTaskIds()` â€” porta jÃ¡ definida no Task 1 e implementada no Task 5 (Sqlite).

- [ ] **Step 3: Implementar o Reconciler**

```ts
// src/application/calendar/CalendarReconciler.ts
import type { TaskRepository } from '../../domain/task/TaskRepository';
import { isTerminalStatus } from '../../domain/task/TaskStatus';
import type { CalendarOutbox, CalendarProjection, CurrentUserPort } from './ports';
import { snapshotFromTask, snapshotHash } from './TaskToEventMapper';

export interface ReconcileOpts { now: string; }
export interface ReconcileStats { enqueued: number; }

export class CalendarReconciler {
    constructor(
        private readonly tasks: TaskRepository,
        private readonly projection: CalendarProjection,
        private readonly outbox: CalendarOutbox,
        private readonly currentUser: CurrentUserPort,
    ) {}

    async reconcile(opts: ReconcileOpts): Promise<ReconcileStats> {
        const me = await this.currentUser.getCurrentUserId();
        let enqueued = 0;
        if (!me) return { enqueued };

        const mine = await this.tasks.query({ assignedTo: me, includeArchived: true });
        const activeByMe = new Map<string, boolean>();
        for (const t of mine) {
            const active = !t.arquivado && !isTerminalStatus(t.status) && !!t.toProps().prazo;
            activeByMe.set(t.id, active);
            if (active) {
                const snap = snapshotFromTask(t);
                const hash = await snapshotHash(snap);
                const proj = await this.projection.findByTaskId(t.id);
                if (!proj || proj.lastSyncedHash !== hash) {
                    await this.outbox.insert({ taskId: t.id, op: 'upsert', payload: JSON.stringify(snap), now: opts.now });
                    enqueued++;
                }
            }
        }
        // orfaos
        const projected = await this.projection.listAllTaskIds();
        for (const taskId of projected) {
            if (!activeByMe.get(taskId)) {
                await this.outbox.insert({ taskId, op: 'cancel', payload: '{}', now: opts.now });
                enqueued++;
            }
        }
        return { enqueued };
    }
}
```

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/application/calendar/__tests__/CalendarReconciler.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/application/calendar/CalendarReconciler.ts desktop/src/application/calendar/__tests__/CalendarReconciler.test.ts
git commit -m "feat(calendar): add CalendarReconciler"
```

---

## Task 8: GoogleCalendarAdapter (CalendarGateway REST v3)

**Files:**
- Create: `desktop/src/infrastructure/calendar/GoogleCalendarAdapter.ts`
- Test: `desktop/src/infrastructure/calendar/__tests__/GoogleCalendarAdapter.test.ts`

**Interfaces:**
- Consumes: `CalendarGateway`, `GoogleEvent` (Task 1); `fetch` global.
- Produces: `class GoogleCalendarAdapter implements CalendarGateway`.
- Endpoints: insert `POST .../calendars/primary/events`; update `PATCH .../calendars/primary/events/{id}`; delete `DELETE .../calendars/primary/events/{id}`. 404 no delete Ã© sucesso.

- [ ] **Step 1: Escrever o teste (falha)** â€” mock global `fetch`

```ts
// src/infrastructure/calendar/__tests__/GoogleCalendarAdapter.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleCalendarAdapter } from '../GoogleCalendarAdapter';

function res(body: unknown, init: { status?: number; ok?: boolean } = {}) {
    const status = init.status ?? 200;
    return { ok: init.ok ?? (status >= 200 && status < 300), status, json: async () => body, text: async () => JSON.stringify(body) } as unknown as Response;
}

describe('GoogleCalendarAdapter', () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    beforeEach(() => { fetchMock = vi.fn(); (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch; });

    it('upsert faz POST quando nao ha eventId existente', async () => {
        fetchMock.mockResolvedValueOnce(res({ id: 'evt1', etag: '"e1"' }));
        const gw = new GoogleCalendarAdapter();
        const out = await gw.upsertEvent({ summary: 'T', start: { date: '2026-07-10' }, end: { date: '2026-07-11' } }, undefined, 'TOKEN');
        expect(out).toEqual({ id: 'evt1', etag: '"e1"' });
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toContain('/calendars/primary/events');
        expect(init.method).toBe('POST');
        expect(init.headers.Authorization).toBe('Bearer TOKEN');
    });

    it('upsert faz PATCH quando ha eventId existente', async () => {
        fetchMock.mockResolvedValueOnce(res({ id: 'evt9', etag: '"e9"' }));
        const gw = new GoogleCalendarAdapter();
        await gw.upsertEvent({ summary: 'T', start: { date: '2026-07-10' }, end: { date: '2026-07-11' } }, 'evt9', 'TOKEN');
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toMatch(/\/events\/evt9$/);
        expect(init.method).toBe('PATCH');
    });

    it('upsert 4xx lancera com status', async () => {
        fetchMock.mockResolvedValueOnce(res({ error: { message: 'bad' } }, { status: 400 }));
        await expect(new GoogleCalendarAdapter().upsertEvent({ summary: 'T', start: { date: 'x' }, end: { date: 'y' } }, undefined, 'T')).rejects.toMatchObject({ status: 400 });
    });

    it('delete 404 e silencioso (sucesso)', async () => {
        fetchMock.mockResolvedValueOnce(res({}, { status: 404 }));
        await expect(new GoogleCalendarAdapter().deleteEvent('evt9', 'T')).resolves.toBeUndefined();
        const [, init] = fetchMock.mock.calls[0];
        expect(init.method).toBe('DELETE');
    });

    it('delete 4xx lancara', async () => {
        fetchMock.mockResolvedValueOnce(res({}, { status: 403 }));
        await expect(new GoogleCalendarAdapter().deleteEvent('evt9', 'T')).rejects.toMatchObject({ status: 403 });
    });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/infrastructure/calendar/__tests__/GoogleCalendarAdapter.test.ts`
Expected: FAIL â€” classe inexistente.

- [ ] **Step 3: Implementar**

```ts
// src/infrastructure/calendar/GoogleCalendarAdapter.ts
import type { CalendarGateway, GoogleEvent } from '../../application/calendar/ports';

const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

interface HttpError extends Error { status: number; }

async function asHttpError(resp: Response): Promise<HttpError> {
    let msg = `google calendar ${resp.status}`;
    try { const body = await resp.json(); if (body?.error?.message) msg = body.error.message; } catch { /* noop */ }
    const err = new Error(msg) as HttpError; err.status = resp.status; return err;
}

export class GoogleCalendarAdapter implements CalendarGateway {
    async upsertEvent(event: GoogleEvent, existingEventId: string | undefined, accessToken: string): Promise<{ id: string; etag: string | null }> {
        const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
        let resp: Response;
        if (existingEventId) {
            resp = await fetch(`${BASE}/${existingEventId}`, { method: 'PATCH', headers, body: JSON.stringify(event) });
        } else {
            resp = await fetch(BASE, { method: 'POST', headers, body: JSON.stringify(event) });
        }
        if (!resp.ok) throw await asHttpError(resp);
        const body = await resp.json() as { id: string; etag?: string };
        return { id: body.id, etag: body.etag ?? null };
    }

    async deleteEvent(eventId: string, accessToken: string): Promise<void> {
        const resp = await fetch(`${BASE}/${eventId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
        if (resp.status === 404) return;
        if (!resp.ok) throw await asHttpError(resp);
    }
}
```

- [ ] **Step 4: Rodar e confirmar passagem**

Run: `npx vitest run src/infrastructure/calendar/__tests__/GoogleCalendarAdapter.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add desktop/src/infrastructure/calendar/GoogleCalendarAdapter.ts desktop/src/infrastructure/calendar/__tests__/GoogleCalendarAdapter.test.ts
git commit -m "feat(calendar): add GoogleCalendarAdapter (REST v3) with 404 tolerance"
```

---

## Task 9: GoogleOAuthClient + TauriTokenStore + LocalSessionCurrentUserPort + Tauri commands

**Files:**
- Create: `desktop/src/infrastructure/calendar/GoogleOAuthClient.ts`
- Create: `desktop/src/infrastructure/calendar/TauriTokenStore.ts`
- Create: `desktop/src/infrastructure/calendar/GoogleOAuthTokenRefresher.ts`
- Create: `desktop/src/infrastructure/calendar/LocalSessionCurrentUserPort.ts`
- Create: `desktop/src/infrastructure/calendar/__tests__/GoogleOAuthClient.test.ts`
- Create: `desktop/src-tauri/src/commands/google_calendar.rs`
- Modify: `desktop/src-tauri/src/commands/mod.rs`
- Modify: `desktop/src-tauri/src/lib.rs`
- Modify: `desktop/src-tauri/Cargo.toml`
- Modify: `desktop/src-tauri/capabilities/default.json`

**Interfaces:**
- Consumes: `TokenStore`, `TokenRefresher`, `CurrentUserPort` (Task 1); sessao local Tauri (`get_session`); Tauri `invoke`.
- Produz:
  - `class GoogleOAuthClient { startAuth(): Promise<AuthResult>; completeAuth(code, redirectUri, codeVerifier): Promise<Tokens>; refresh(refreshToken): Promise<Tokens> }`
  - `class TauriTokenStore implements TokenStore`
  - `class GoogleOAuthTokenRefresher implements TokenRefresher`
  - `class LocalSessionCurrentUserPort implements CurrentUserPort`
  - comandos Tauri `google_calendar_start_auth`, `google_calendar_token_get`, `google_calendar_token_set`, `google_calendar_token_clear`.
- OAuth: loopback `http://127.0.0.1:{port}`; client_id de `process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`; PKCE `S256`; `state` obrigatório. O comando Tauri deve ter timeout/cancelamento para fluxo abandonado.
- Regra de runtime: frontend Next/browser **não** importa `keytar`, `http` ou `net`. Listener loopback, abertura do browser e keychain ficam em Rust.

- [ ] **Step 1: Adicionar dependências Rust**

Em `desktop/src-tauri/Cargo.toml`, adicione se ausentes:

```toml
open = "5"
keyring = "3"
url = "2"
```

`sha2`, `base64`, `rand` e `serde` já existem hoje no projeto; se o implementador não os encontrar, adiciona versões compatíveis com o lockfile.

Run: `cargo check` (em `desktop/src-tauri`)
Expected: PASS após registrar os comandos nos passos abaixo.

- [ ] **Step 2: Escrever o teste do OAuth (falha)**

```ts
// src/infrastructure/calendar/__tests__/GoogleOAuthClient.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GoogleOAuthClient } from '../GoogleOAuthClient';

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';

function res(body: unknown, status = 200) {
    return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

describe('GoogleOAuthClient', () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    const invokeMock = vi.mocked(invoke);

    beforeEach(() => {
        fetchMock = vi.fn();
        (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
        invokeMock.mockReset();
    });

    it('startAuth delega loopback/open para Tauri command', async () => {
        invokeMock.mockResolvedValueOnce({ code: 'CODE', redirectUri: 'http://127.0.0.1:4242', codeVerifier: 'VERIFIER' });
        const result = await new GoogleOAuthClient('CID').startAuth();
        expect(result).toEqual({ code: 'CODE', redirectUri: 'http://127.0.0.1:4242', codeVerifier: 'VERIFIER' });
        expect(invokeMock).toHaveBeenCalledWith('google_calendar_start_auth', {
            clientId: 'CID',
            scope: 'https://www.googleapis.com/auth/calendar.events',
        });
    });

    it('completeAuth troca code por tokens usando PKCE verifier', async () => {
        fetchMock.mockResolvedValueOnce(res({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }));
        const tokens = await new GoogleOAuthClient('CID').completeAuth('CODE', 'http://127.0.0.1:4242', 'VERIFIER');
        expect(tokens.access).toBe('a');
        expect(tokens.refresh).toBe('r');
        const [, init] = fetchMock.mock.calls[0];
        const body = String(init.body);
        expect(body).toContain('code=CODE');
        expect(body).toContain('client_id=CID');
        expect(body).toContain('code_verifier=VERIFIER');
        expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    });

    it('refresh renova access_token', async () => {
        fetchMock.mockResolvedValueOnce(res({ access_token: 'a2', expires_in: 3600 }));
        const tokens = await new GoogleOAuthClient('CID').refresh('r');
        expect(tokens.access).toBe('a2');
        expect(tokens.refresh).toBe('r');
    });

    it('refresh 400 lancara com status', async () => {
        fetchMock.mockResolvedValueOnce(res({ error: 'invalid_grant' }, 400));
        await expect(new GoogleOAuthClient('CID').refresh('bad')).rejects.toMatchObject({ status: 400 });
    });
});
```

- [ ] **Step 3: Rodar e confirmar falha**

Run: `npx vitest run src/infrastructure/calendar/__tests__/GoogleOAuthClient.test.ts`
Expected: FAIL — classe inexistente.

- [ ] **Step 4: Implementar `GoogleOAuthClient`**

```ts
// src/infrastructure/calendar/GoogleOAuthClient.ts
import { invoke } from '@tauri-apps/api/core';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

export interface Tokens { access: string; refresh: string; expiresAtIso: string; }
export interface AuthResult { code: string; redirectUri: string; codeVerifier: string; }

interface HttpError extends Error { status: number; }
async function asHttpError(resp: Response): Promise<HttpError> {
    const err = new Error(`oauth ${resp.status}`) as HttpError;
    err.status = resp.status;
    return err;
}

export class GoogleOAuthClient {
    constructor(private readonly clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID ?? '') {}

    async startAuth(): Promise<AuthResult> {
        if (!this.clientId) throw new Error('missing-google-oauth-client-id');
        return invoke<AuthResult>('google_calendar_start_auth', { clientId: this.clientId, scope: SCOPE });
    }

    async completeAuth(code: string, redirectUri: string, codeVerifier: string): Promise<Tokens> {
        const body = new URLSearchParams({
            code,
            client_id: this.clientId,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier,
            grant_type: 'authorization_code',
        });
        const resp = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
        if (!resp.ok) throw await asHttpError(resp);
        const j = await resp.json() as { access_token: string; refresh_token?: string; expires_in: number };
        return { access: j.access_token, refresh: j.refresh_token ?? '', expiresAtIso: new Date(Date.now() + j.expires_in * 1000).toISOString() };
    }

    async refresh(refreshToken: string): Promise<Tokens> {
        const body = new URLSearchParams({ client_id: this.clientId, refresh_token: refreshToken, grant_type: 'refresh_token' });
        const resp = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
        if (!resp.ok) throw await asHttpError(resp);
        const j = await resp.json() as { access_token: string; expires_in: number };
        return { access: j.access_token, refresh: refreshToken, expiresAtIso: new Date(Date.now() + j.expires_in * 1000).toISOString() };
    }
}
```

- [ ] **Step 5: Implementar comandos Tauri**

```rust
// src-tauri/src/commands/google_calendar.rs
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{distributions::Alphanumeric, Rng};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::{Read, Write};
use std::net::TcpListener;
use url::Url;

const SERVICE: &str = "ecoforms.google-calendar";

#[derive(Serialize)]
pub struct GoogleCalendarAuthResult {
    pub code: String,
    #[serde(rename = "redirectUri")]
    pub redirect_uri: String,
    #[serde(rename = "codeVerifier")]
    pub code_verifier: String,
}

fn random_token(len: usize) -> String {
    rand::thread_rng().sample_iter(&Alphanumeric).take(len).map(char::from).collect()
}

fn pkce_challenge(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

#[tauri::command]
pub fn google_calendar_start_auth(client_id: String, scope: String) -> Result<GoogleCalendarAuthResult, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    let redirect_uri = format!("http://127.0.0.1:{port}");
    let state = random_token(32);
    let code_verifier = random_token(64);
    let code_challenge = pkce_challenge(&code_verifier);
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent&code_challenge={}&code_challenge_method=S256&state={}",
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&scope),
        urlencoding::encode(&code_challenge),
        urlencoding::encode(&state),
    );
    open::that(auth_url).map_err(|e| e.to_string())?;

    let (mut stream, _) = listener.accept().map_err(|e| e.to_string())?;
    let mut buf = [0_u8; 4096];
    let n = stream.read(&mut buf).map_err(|e| e.to_string())?;
    let req = String::from_utf8_lossy(&buf[..n]);
    let path = req.lines().next().and_then(|l| l.split_whitespace().nth(1)).ok_or("invalid oauth request")?;
    let url = Url::parse(&format!("http://127.0.0.1:{port}{path}")).map_err(|e| e.to_string())?;
    let got_state = url.query_pairs().find(|(k, _)| k == "state").map(|(_, v)| v.to_string()).unwrap_or_default();
    if got_state != state { return Err("oauth-state-mismatch".to_string()); }
    let code = url.query_pairs().find(|(k, _)| k == "code").map(|(_, v)| v.to_string()).ok_or("missing oauth code")?;
    let _ = stream.write_all(b"HTTP/1.1 200 OK\r\ncontent-type: text/html; charset=utf-8\r\n\r\n<h1>Conectado. Pode fechar esta janela.</h1>");
    Ok(GoogleCalendarAuthResult { code, redirect_uri, code_verifier })
}

fn token_key(user_id: &str, kind: &str) -> String { format!("{user_id}.{kind}") }

#[tauri::command]
pub fn google_calendar_token_get(user_id: String, kind: String) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SERVICE, &token_key(&user_id, &kind)).map_err(|e| e.to_string())?;
    match entry.get_password() { Ok(v) => Ok(Some(v)), Err(_) => Ok(None) }
}

#[tauri::command]
pub fn google_calendar_token_set(user_id: String, kind: String, value: String) -> Result<(), String> {
    keyring::Entry::new(SERVICE, &token_key(&user_id, &kind)).map_err(|e| e.to_string())?.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn google_calendar_token_clear(user_id: String) -> Result<(), String> {
    for kind in ["refresh", "access"] {
        if let Ok(entry) = keyring::Entry::new(SERVICE, &token_key(&user_id, kind)) { let _ = entry.delete_credential(); }
    }
    Ok(())
}
```

> Adicionar também `urlencoding = "2"` em `Cargo.toml`, registrar `pub mod google_calendar;` em `src-tauri/src/commands/mod.rs` e incluir os 4 comandos no `tauri::generate_handler![...]` de `src-tauri/src/lib.rs`.

- [ ] **Step 6: Implementar `TauriTokenStore`, `GoogleOAuthTokenRefresher` e `LocalSessionCurrentUserPort`**

`GoogleOAuthTokenRefresher` deve consultar `TauriTokenStore.getAccessToken`. Se o access token estiver ausente/expirado, deve usar `GoogleOAuthClient.refresh(refreshToken)`, persistir o novo access token e retornar o token valido. Sem refresh token, retorna `null` sem incrementar tentativas permanentemente.

```ts
// src/infrastructure/calendar/TauriTokenStore.ts
import { invoke } from '@tauri-apps/api/core';
import type { TokenStore } from '../../application/calendar/ports';

export class TauriTokenStore implements TokenStore {
    async getRefreshToken(userId: string): Promise<string | null> {
        return invoke<string | null>('google_calendar_token_get', { userId, kind: 'refresh' });
    }
    async setRefreshToken(userId: string, token: string): Promise<void> {
        await invoke('google_calendar_token_set', { userId, kind: 'refresh', value: token });
    }
    async getAccessToken(userId: string): Promise<string | null> {
        const raw = await invoke<string | null>('google_calendar_token_get', { userId, kind: 'access' });
        if (!raw) return null;
        const [expiresAtIso, token] = raw.split('|');
        return Date.parse(expiresAtIso) > Date.now() ? token : null;
    }
    async setAccessToken(userId: string, token: string, expiresAtIso: string): Promise<void> {
        await invoke('google_calendar_token_set', { userId, kind: 'access', value: `${expiresAtIso}|${token}` });
    }
    async clear(userId: string): Promise<void> {
        await invoke('google_calendar_token_clear', { userId });
    }
}
```

```ts
// src/infrastructure/calendar/LocalSessionCurrentUserPort.ts
import { invoke } from '@tauri-apps/api/core';
import type { CurrentUserPort } from '../../application/calendar/ports';

export class LocalSessionCurrentUserPort implements CurrentUserPort {
    async getCurrentUserId(): Promise<string | null> {
        const session = await invoke<{ user_id: string; perfil: string } | null>('get_session');
        return session?.user_id ?? null;
    }
}
```

- [ ] **Step 7: Registrar capability Tauri**

Em `desktop/src-tauri/capabilities/default.json`, adicionar permissões para os comandos novos se o arquivo usar allowlist explícita de commands. Seguir o padrão já existente no arquivo; não criar permissão genérica ampla.

- [ ] **Step 8: Rodar testes do OAuth**

Run: `npx vitest run src/infrastructure/calendar/__tests__/GoogleOAuthClient.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 9: Typecheck + cargo check**

Run: `npm run typecheck`
Expected: PASS.

Run: `cargo check` (em `desktop/src-tauri`)
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add desktop/src/infrastructure/calendar/ desktop/src-tauri/src/commands/google_calendar.rs desktop/src-tauri/src/commands/mod.rs desktop/src-tauri/src/lib.rs desktop/src-tauri/Cargo.toml desktop/src-tauri/Cargo.lock desktop/src-tauri/capabilities/default.json
git commit -m "feat(calendar): add Google OAuth and token keychain bridge"
```

---
## Task 10: Conectar CalendarIntegrationService aos use cases de task

**Files:**
- Modify: `desktop/src/application/task/CreateTaskUseCase.ts`
- Modify: `desktop/src/application/task/MoveTaskUseCase.ts`
- Modify: `desktop/src/application/task/AssignTaskUseCase.ts`
- Modify: `desktop/src/application/task/ArchiveTaskUseCase.ts`
- Modify: `desktop/src/application/task/UnarchiveTaskUseCase.ts`
- Modify: `desktop/src/application/task/DeleteTaskUseCase.ts`
- Modify: os respectivos testes em `src/application/task/__tests__/`

**Interfaces:**
- Consumes: `CalendarIntegrationService` (Task 3), `ClockPort` (existente; se o use case jÃ¡ recebe `clock`, reusar â€” senÃ£o usar `new Date().toISOString()`).
- EstratÃ©gia: adicionar parÃ¢metro **opcional** `calendar?: CalendarIntegrationService` no construtor e chamar `await this.calendar?.onTaskChanged(task, { now, removed? })` apÃ³s `save` (e apÃ³s `delete`, passando a `task` buscada antes da exclusÃ£o).

- [ ] **Step 1: Exemplo de modificaÃ§Ã£o â€” `AssignTaskUseCase` (escrever/atualizar o teste primeiro)**

```ts
// src/application/task/__tests__/AssignTaskUseCase.test.ts
import { describe, it, expect } from 'vitest';
import { Task } from '../../../domain/task/Task';
import { AssignTaskUseCase } from '../AssignTaskUseCase';
import { InMemoryTaskRepository } from '../../../test/fakes/InMemoryTaskRepository';
import { CalendarIntegrationService } from '../../calendar/CalendarIntegrationService';
import type { CalendarOutbox, CalendarProjection, CurrentUserPort } from '../../calendar/ports';

class SpyOutbox implements CalendarOutbox {
    enqueued: Array<{ taskId: string; op: string }> = [];
    async insert(i: { taskId: string; op: 'upsert' | 'cancel' }) { this.enqueued.push(i); return 'x'; }
    async findPending() { return []; } async markInFlight() {} async markDone() {} async markFailed() {} async markDead() {}
}

function svc(me: string | null) {
    const outbox = new SpyOutbox();
    const projection: CalendarProjection = { findByTaskId: async () => null, upsert: async () => {}, delete: async () => {}, listAllTaskIds: async () => [] };
    const user: CurrentUserPort = { getCurrentUserId: async () => me };
    return { outbox, calendar: new CalendarIntegrationService(outbox, projection, user) };
}

describe('AssignTaskUseCase + calendar', () => {
    it('enfileira upsert quando atribui a mim', async () => {
        const tasks = new InMemoryTaskRepository();
        const t = Task.fromProps({ id: 't1', titulo: 'T', status: 'a_fazer', prioridade: 'media', ordem: 0, criadoPor: 'u', atribuidoPara: null, prazo: '2026-07-10', tipoPrazo: 'unico' });
        await tasks.save(t);
        const { outbox, calendar } = svc('me');
        await new AssignTaskUseCase(tasks, calendar).execute({ id: 't1', atribuidoPara: 'me' });
        expect(outbox.enqueued).toEqual([{ taskId: 't1', op: 'upsert' }]);
    });

    it('enfileira cancel quando desatribui de mim (havia projection)', async () => {
        const tasks = new InMemoryTaskRepository();
        const t = Task.fromProps({ id: 't1', titulo: 'T', status: 'a_fazer', prioridade: 'media', ordem: 0, criadoPor: 'u', atribuidoPara: 'me', prazo: '2026-07-10', tipoPrazo: 'unico' });
        await tasks.save(t);
        const { outbox, calendar } = svc('me');
        // projection prÃ©-existente
        const projection: CalendarProjection = { findByTaskId: async () => ({ taskId: 't1', googleCalendarId: 'primary', googleEventId: 'e', etag: null, lastSyncedHash: 'h', lastSyncedAt: 'x' }), upsert: async () => {}, delete: async () => {}, listAllTaskIds: async () => ['t1'] };
        const user: CurrentUserPort = { getCurrentUserId: async () => 'me' };
        const cal = new CalendarIntegrationService(outbox, projection, user);
        await new AssignTaskUseCase(tasks, cal).execute({ id: 't1', atribuidoPara: null });
        expect(outbox.enqueued[0].op).toBe('cancel');
    });

    it('funciona sem calendar (sem erro)', async () => {
        const tasks = new InMemoryTaskRepository();
        const t = Task.fromProps({ id: 't1', titulo: 'T', status: 'a_fazer', prioridade: 'media', ordem: 0, criadoPor: 'u', atribuidoPara: null });
        await tasks.save(t);
        await expect(new AssignTaskUseCase(tasks).execute({ id: 't1', atribuidoPara: 'me' })).resolves.toBeTruthy();
    });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/application/task/__tests__/AssignTaskUseCase.test.ts`
Expected: FAIL â€” `new AssignTaskUseCase(tasks, calendar)` nÃ£o compila (construtor sÃ³ recebe `tasks`).

- [ ] **Step 3: Modificar `AssignTaskUseCase`**

```ts
// src/application/task/AssignTaskUseCase.ts
import { NotFoundError } from '../../domain/shared/errors';
import type { TaskRepository } from '../../domain/task/TaskRepository';
import type { CalendarIntegrationService } from '../calendar/CalendarIntegrationService';
import type { AssignTaskInput, TaskDto } from './dto/TaskDto';
import { toTaskDto } from './mappers';

export class AssignTaskUseCase {
    constructor(
        private readonly tasks: TaskRepository,
        private readonly calendar?: CalendarIntegrationService,
    ) {}

    async execute(input: AssignTaskInput): Promise<TaskDto> {
        const task = await this.tasks.findById(input.id);
        if (!task) throw new NotFoundError('Task', input.id);
        task.assignTo(input.atribuidoPara);
        await this.tasks.save(task);
        await this.calendar?.onTaskChanged(task, { now: new Date().toISOString() });
        return toTaskDto(task);
    }
}
```

- [ ] **Step 4: Aplicar o mesmo padrÃ£o nos outros 5 use cases**

Para cada um, adicione `private readonly calendar?: CalendarIntegrationService` ao construtor (apÃ³s os params existentes) e, **apÃ³s** o `save`/`delete`, chame `onTaskChanged`:

| Use Case | Trecho a adicionar apÃ³s a persistÃªncia |
|---|---|
| `CreateTaskUseCase` | `await this.calendar?.onTaskChanged(task, { now });` (jÃ¡ tem `now` do `clock`) |
| `MoveTaskUseCase` | `await this.calendar?.onTaskChanged(task, { now: new Date().toISOString() });` (status `concluido`/`cancelado` => o service decide `cancel`) |
| `ArchiveTaskUseCase` | `await this.calendar?.onTaskChanged(task, { now: new Date().toISOString() });` (arquivado => `cancel`) |
| `UnarchiveTaskUseCase` | `await this.calendar?.onTaskChanged(task, { now: new Date().toISOString() });` |
| `DeleteTaskUseCase` | antes de `delete`, jÃ¡ busca `task`; apÃ³s `delete`, `await this.calendar?.onTaskChanged(task, { now: new Date().toISOString(), removed: true });` |

Import em cada arquivo: `import type { CalendarIntegrationService } from '../calendar/CalendarIntegrationService';`.

- [ ] **Step 5: Atualizar testes existentes que instanciam esses use cases**

Localizar testes que fazem `new XxxTaskUseCase(tasks, sync, â€¦)` e confirmar que `calendar` Ã© opcional (nÃ£o quebra). Adicionar parÃ¢metro `undefined` **apenas se** o construtor exigir ordem posicional â€” como Ã© opcional ao final, nÃ£o Ã© necessÃ¡rio.

Run: `npx vitest run src/application/task`
Expected: PASS (todos os testes de task).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add desktop/src/application/task
git commit -m "feat(calendar): wire CalendarIntegrationService into task use cases"
```

---

## Task 11: Registro no DI container

**Files:**
- Modify: `desktop/src/infrastructure/container.ts`

**Interfaces:**
- Consumes: todas as peÃ§as anteriores.
- Produz: instÃ¢ncias de `CalendarOutbox`, `CalendarProjection`, `CalendarGateway`, `TokenStore`, `TokenRefresher`, `CurrentUserPort`, `CalendarIntegrationService`, `CalendarOutboxDrainer`, `CalendarReconciler` expostas no `Container`; injeÃ§Ã£o nos 6 use cases; garantia de tabelas (`ensureCalendarTables`).

- [ ] **Step 1: Estender a interface `Container`**

Adicione Ã  interface `Container` (no `container.ts`):
```ts
calendarIntegration: CalendarIntegrationService;
calendarDrainer: CalendarOutboxDrainer;
calendarReconciler: CalendarReconciler;
calendarTokenStore: TokenStore;
calendarCurrentUser: CurrentUserPort;
calendarTokenRefresher: TokenRefresher;
```

- [ ] **Step 2: Implementar `ensureCalendarTables(sqlite)` idempotente**

Dentro de `container.ts`, adicione:
```ts
async function ensureCalendarTables(sqlite: SqlitePort): Promise<void> {
    await sqlite.execute(`CREATE TABLE IF NOT EXISTS calendar_outbox (
        id TEXT PRIMARY KEY, task_id TEXT NOT NULL, op TEXT NOT NULL,
        payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT, next_retry_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))`,
        [], { bootstrap: true });
    await sqlite.execute(`CREATE INDEX IF NOT EXISTS idx_calendar_outbox_drain ON calendar_outbox(status, next_retry_at)`, [], { bootstrap: true });
    await sqlite.execute(`CREATE TABLE IF NOT EXISTS task_calendar_projection (
        task_id TEXT PRIMARY KEY, google_calendar_id TEXT NOT NULL, google_event_id TEXT NOT NULL,
        etag TEXT, last_synced_hash TEXT NOT NULL, last_synced_at TEXT NOT NULL DEFAULT (datetime('now')))`,
        [], { bootstrap: true });
}
```
Chame `await ensureCalendarTables(sqlite);` dentro de `initDatabase()`/`getContainer()` (apÃ³s `db_connect`), ao lado das demais inicializaÃ§Ãµes de schema.

- [ ] **Step 3: Instanciar e conectar as peÃ§as em `getContainer()`**

```ts
// dentro da montagem do container (apÃ³s sqlite pronto):
import { SqliteCalendarOutboxRepository } from './persistence/sqlite/SqliteCalendarOutboxRepository';
import { SqliteTaskCalendarProjectionRepository } from './persistence/sqlite/SqliteTaskCalendarProjectionRepository';
import { GoogleCalendarAdapter } from './calendar/GoogleCalendarAdapter';
import { GoogleOAuthClient } from './calendar/GoogleOAuthClient';
import { TauriTokenStore } from './calendar/TauriTokenStore';
import { GoogleOAuthTokenRefresher } from './calendar/GoogleOAuthTokenRefresher';
import { LocalSessionCurrentUserPort } from './calendar/LocalSessionCurrentUserPort';
import { CalendarIntegrationService } from '../application/calendar/CalendarIntegrationService';
import { CalendarOutboxDrainer } from '../application/calendar/CalendarOutboxDrainer';
import { CalendarReconciler } from '../application/calendar/CalendarReconciler';

const calendarOutbox = new SqliteCalendarOutboxRepository(sqlite);
const calendarProjection = new SqliteTaskCalendarProjectionRepository(sqlite);
const calendarGateway = new GoogleCalendarAdapter();
const calendarTokenStore = new TauriTokenStore();
const calendarTokenRefresher = new GoogleOAuthTokenRefresher(calendarTokenStore, new GoogleOAuthClient());
const calendarCurrentUser = new LocalSessionCurrentUserPort();
const calendarIntegration = new CalendarIntegrationService(calendarOutbox, calendarProjection, calendarCurrentUser);
const calendarDrainer = new CalendarOutboxDrainer(calendarOutbox, calendarProjection, calendarGateway, calendarTokenRefresher, calendarCurrentUser);
const calendarReconciler = new CalendarReconciler(taskRepository, calendarProjection, calendarOutbox, calendarCurrentUser);
```
Injete `calendarIntegration` ao instanciar `CreateTaskUseCase`, `MoveTaskUseCase`, `AssignTaskUseCase`, `ArchiveTaskUseCase`, `UnarchiveTaskUseCase`, `DeleteTaskUseCase`. Exponha `calendarIntegration`, `calendarDrainer`, `calendarReconciler`, `calendarTokenStore`, `calendarTokenRefresher`, `calendarCurrentUser` no objeto retornado.

- [ ] **Step 4: Typecheck + testes**

Run: `npm run typecheck && npx vitest run`
Expected: PASS (typecheck) e testes existentes verdes.

- [ ] **Step 5: Commit**

```bash
git add desktop/src/infrastructure/container.ts
git commit -m "feat(calendar): register calendar services in DI container"
```

---

## Task 12: Lifecycle do Drainer/Reconciler (hook)

**Files:**
- Create: `desktop/src/interface/hooks/useGoogleCalendar.ts`

**Interfaces:**
- Consumes: `Container` (via hook existente de container; usar o mesmo padrÃ£o de outros hooks de `interface/hooks`), `window` events (focus/online). Deve ser montado por um provider/layout autenticado global; a tela de Settings apenas chama connect/disconnect/status.

- [ ] **Step 1: Implementar o hook**

```ts
// src/interface/hooks/useGoogleCalendar.ts
import { useEffect, useState } from 'react';
import { useContainer } from './utils/useContainer';

export type CalendarConnectionState = 'unknown' | 'connected' | 'disconnected';

export function useGoogleCalendar() {
    const container = useContainer();
    const [state, setState] = useState<CalendarConnectionState>('unknown');

    useEffect(() => {
        if (!container) return;
        let cancelled = false;
        const tick = async () => {
            const me = await container.calendarCurrentUser.getCurrentUserId();
            if (cancelled) return;
            if (!me) { setState('disconnected'); return; }
            const refresh = await container.calendarTokenStore.getRefreshToken(me);
            if (cancelled) return;
            setState(refresh ? 'connected' : 'disconnected');
            if (refresh) await container.calendarDrainer.drainOnce({ now: new Date().toISOString() });
        };
        void tick();
        const interval = setInterval(() => void tick(), 30_000);
        window.addEventListener('focus', tick);
        window.addEventListener('online', tick);
        return () => { cancelled = true; clearInterval(interval); window.removeEventListener('focus', tick); window.removeEventListener('online', tick); };
    }, [container]);

    return {
        state,
        connect: async () => {
            const oauth = await import('../../infrastructure/calendar/GoogleOAuthClient');
            const client = new oauth.GoogleOAuthClient();
            const { code, redirectUri, codeVerifier } = await client.startAuth();
            const tokens = await client.completeAuth(code, redirectUri, codeVerifier);
            const me = await container?.calendarCurrentUser.getCurrentUserId();
            if (!me) return;
            await container.calendarTokenStore.setRefreshToken(me, tokens.refresh);
            await container.calendarTokenStore.setAccessToken(me, tokens.access, tokens.expiresAtIso);
            await container.calendarReconciler.reconcile({ now: new Date().toISOString() });
        },
        disconnect: async () => {
            const me = await container?.calendarCurrentUser.getCurrentUserId();
            if (!me) return;
            await container.calendarTokenStore.clear(me);
        },
    };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add desktop/src/interface/hooks/useGoogleCalendar.ts
git commit -m "feat(calendar): add useGoogleCalendar hook (drain/reconcile lifecycle)"
```

---

## Task 13: UI de Settings â€” Conectar/Desconectar

**Files:**
- Create: `desktop/components/settings/GoogleCalendarSettings.tsx`
- Modify: a pÃ¡gina de Settings existente (adicionar a seÃ§Ã£o) â€” localizar em `desktop/components/settings/` ou `app/.../settings`.

**Interfaces:**
- Consumes: `useGoogleCalendar` (Task 12). Segue padrÃµes visuais existentes (Radix UI + Tailwind, jÃ¡ no projeto).

- [ ] **Step 1: Implementar o componente**

```tsx
// desktop/components/settings/GoogleCalendarSettings.tsx
'use client';
import { useGoogleCalendar } from '../../src/interface/hooks/useGoogleCalendar';

export function GoogleCalendarSettings() {
    const { state, connect, disconnect } = useGoogleCalendar();
    const connected = state === 'connected';

    return (
        <section className="space-y-2 rounded-md border p-4">
            <h2 className="text-lg font-semibold">Google Calendar</h2>
            <p className="text-sm text-muted-foreground">
                Publica automaticamente na sua agenda as tarefas atribuÃ­das a vocÃª (lembrete pessoal).
            </p>
            <p className="text-sm">
                Status: <strong>{state === 'unknown' ? 'â€”' : connected ? 'Conectado' : 'Desconectado'}</strong>
            </p>
            <div className="flex gap-2">
                <button
                    type="button"
                    className="rounded bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50"
                    disabled={connected || state === 'unknown'}
                    onClick={() => void connect()}
                >
                    Conectar
                </button>
                <button
                    type="button"
                    className="rounded border px-3 py-1.5 disabled:opacity-50"
                    disabled={!connected}
                    onClick={() => void disconnect()}
                >
                    Desconectar
                </button>
            </div>
        </section>
    );
}
```

- [ ] **Step 2: Adicionar `<GoogleCalendarSettings />` na pÃ¡gina de Settings**

Localize a pÃ¡gina de configuraÃ§Ãµes (ex.: `desktop/app/settings/page.tsx` ou componente equivalente) e inclua `<GoogleCalendarSettings />` dentro do layout existente.

- [ ] **Step 3: Typecheck + build de lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add desktop/components/settings/GoogleCalendarSettings.tsx desktop/app/settings
git commit -m "feat(calendar): add Google Calendar settings UI (connect/disconnect)"
```

---

## VerificaÃ§Ã£o final (antes de PR)

- [ ] `npm run typecheck` verde.
- [ ] `npx vitest run` verde (todos os suites novos + existentes).
- [ ] `npm run lint` verde.
- [ ] `cargo check` verde em `desktop/src-tauri`.
- [ ] Fluxo manual (em `npm run start:tauri`): Conectar â†’ criar tarefa para mim com prazo â†’ evento aparece em `primary` â†’ mudar prazo â†’ evento atualizado â†’ concluir/excluir â†’ evento cancelado.
- [ ] Confirmar: arquivos de domÃ­nio `src/domain/task/*` **nÃ£o modificados** (`git diff main -- desktop/src/domain/task` vazio).

## Notas de implementaÃ§Ã£o

- Sempre confira o nome real do export antes de importar (ex.: hook do container, client Supabase). Onde o plano indica um nome provÃ¡vel, o implementador valida contra o cÃ³digo.
- `TauriTokenStore` usa comandos Rust e keychain do SO; testes unitarios mockam `@tauri-apps/api/core`.
- Cota Google: o `Reconciler` sÃ³ enfileira quando o hash muda; o `Drainer` respeita backoff. `dead` (8 tentativas) exige intervenÃ§Ã£o manual na UI (futuro: listar itens `dead`).
