# Google Calendar Integration — Tasks Module

**Data:** 2026-07-01
**Status:** Aprovado (design) — pendente plano de implementação
**Módulo alvo:** `ecoforms/desktop` (Tauri + Next.js, DDD)
**Regra não-negociável:** domínio `Task` permanece **intocado**. Toda integração vive em `application/` e `infrastructure/`.

---

## 1. Objetivo

Publicar automaticamente, na agenda Google do usuário logado, as tarefas atribuídas a si — criando, atualizando e cancelando eventos para espelhar o estado da tarefa. Funciona como **lembrete pessoal**; não publica na agenda de terceiros, não convida outros como attendees e não sincroniza Google→app.

## 2. Decisões de produto (travadas)

| Decisão | Escolha |
|---|---|
| Gatilho | **Automático** — ao atribuir/reagendar/concluir/excluir |
| Ator | **Cliente (Tauri local)** — cada desktop publica só na agenda do próprio usuário logado |
| Ciclo de vida | **Espelho completo** — cria/atualiza/cancela conforme a task muda |
| Direção | **One-way** (app → Google), não bidirecional |
| Escopo de agenda | Apenas agenda `primary` do usuário |
| Attendees | Nenhum (lembrete pessoal) |
| Server-side | **Não** — tokens e chamadas ficam no cliente |

**Implicação de "cliente local":** quando User A atribui uma tarefa a User B, a máquina de A **não** publica nada; a máquina de B, ao receber a tarefa via sync existente, detecta a atribuição a si e enfileira a publicação na própria agenda.

## 3. Arquitetura

Abordagem **A (event-driven + outbox local)** como primária + **C (reconciler periódico)** como auto-cura. Domínio `Task` intocado.

```
interface (UI / Tauri commands)
    Settings: "Conectar Google Calendar" (OAuth loopback), toggle por usuário

application/task
    AssignTaskUseCase  CreateTaskUseCase  MoveTaskUseCase
    ArchiveTaskUseCase  UnarchiveTaskUseCase  DeleteTaskUseCase
        │ após save → CalendarIntegrationService.enqueue(task, op)   ◀ hook leve, não bloqueia

application/calendar   (NOVO)
    CalendarIntegrationService   ── traduz Task → intent, escreve no outbox
    CalendarOutboxDrainer        ── worker: outbox → adapter → projection
    CalendarReconciler           ── scanner periódico (C): difere task vs projection
    TaskToEventMapper            ── Task → Google Event (puro)

infrastructure/calendar  (NOVO)
    GoogleCalendarAdapter        ── REST Google Calendar API (insert/update/patch/delete)
    GoogleOAuthClient            ── loopback 127.0.0.1 flow, refresh token
    TokenStore                   ── refresh_token encriptado (OS keychain)

infrastructure/persistence/sqlite  (NOVO)
    SqliteCalendarOutboxRepository
    SqliteTaskCalendarProjectionRepository

domain/task   ── INTOCADO
```

**Princípios**
- `CalendarIntegrationService` conhece `Task` (domain) mas não conhece Google; fala só com portas (`CalendarGateway`, `TokenStore`, `CalendarOutbox`). Adapter é trocável.
- Use Cases recebem o service por injeção via `infrastructure/container.ts`. Se Google não conectado → enqueue é no-op (zero acoplamento funcional).
- Worker roda em processo Tauri (async, só com janela aberta); offline → item permanece no outbox.

## 4. Modelo de dados

### 4.1 `calendar_outbox` (fila de intenções)
```sql
CREATE TABLE calendar_outbox (
  id            TEXT PRIMARY KEY,                 -- uuid v7
  task_id       TEXT NOT NULL,
  op            TEXT NOT NULL,                    -- 'upsert' | 'cancel'
  payload       TEXT NOT NULL,                    -- JSON snapshot dos campos mapeados da task no momento do enqueue
  status        TEXT NOT NULL DEFAULT 'pending',  -- pending|in_flight|done|dead
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  next_retry_at TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX idx_calendar_outbox_drain ON calendar_outbox(status, next_retry_at);
CREATE INDEX idx_calendar_outbox_task  ON calendar_outbox(task_id);
```

### 4.2 `task_calendar_projection` (espelho + idempotência)
```sql
CREATE TABLE task_calendar_projection (
  task_id            TEXT PRIMARY KEY,
  google_calendar_id TEXT NOT NULL,               -- calendar 'primary'
  google_event_id    TEXT NOT NULL,
  etag               TEXT,
  last_synced_hash   TEXT NOT NULL,               -- sha256 dos campos mapeados
  last_synced_at     TEXT NOT NULL
);
```

## 5. Mapeamento Task → Google Event

`TaskToEventMapper` (função pura, testável por snapshot):

| Task (domain) | Google Event |
|---|---|
| `titulo` | `summary` |
| `descricao` | `description` |
| `prazo` (data) + `tipoPrazo='unico'` | `start/end` all-day; `end = prazo + 1d` |
| `prazo` + `prazoFim` + `tipoPrazo='periodo'` | all-day multi-dia |
| `tipoPrazo='recorrente'` + `recorrencia` | `recurrence[]` em RRULE (ex.: `RRULE:FREQ=WEEKLY;BYDAY=MO`) |
| `prazo` ausente | **não agenda** (nenhum evento) |
| concluída / arquivada / `atribuidoPara=null` / excluída | op `cancel` |

**Hash canônico** (`last_synced_hash`) = `sha256(titulo|descricao|prazo|prazoFim|tipoPrazo|recorrencia)`. O Reconciler só enfileira quando o hash diverge, protegendo a cota da API.

## 6. Gatilhos de enqueue (por Use Case, após `save`)

| Use Case | Condição | op |
|---|---|---|
| `AssignTask` | atribui a `me` | `upsert` |
| `AssignTask` | desatribui de `me` | `cancel` |
| `CreateTask` | criada para `me` | `upsert` |
| `MoveTask` | mudou prazo/status/recorrência | `upsert` (ou `cancel` se passou a concluída) |
| `ArchiveTask` | — | `cancel` |
| `UnarchiveTask` | ainda atribuída a `me` | `upsert` |
| `DeleteTask` | — | `cancel` |

`me` = usuário logado na máquina (resgatado do `TokenStore`).

## 7. Fluxo primário (approach A)

```
UseCase.save(task)
   └→ CalendarIntegrationService.enqueue(task, op)
        └→ SqliteCalendarOutbox.insert (status=pending)        [síncrono, local, rápido]

CalendarOutboxDrainer   (tick a cada 30s enquanto online + on app focus)
   1. SELECT * FROM calendar_outbox
      WHERE status='pending' AND (next_retry_at IS NULL OR next_retry_at <= now)
      LIMIT N
   2. para cada item:
        - marcar status='in_flight'
        - TokenStore.getRefreshToken(me) == null → volta a 'pending' (aguarda OAuth)
        - TaskToEventMapper.toEvent(payload) → event
        - GoogleCalendarAdapter.upsert(event, projection?.googleEventId)
        - sucesso → grava projection + status='done'
        - falha → attempts++, status='pending', next_retry_at = now + backoff
   3. attempts >= 8 → status='dead' (intervenção manual em Settings)
```

## 8. Fluxo de reconciliação (approach C)

`CalendarReconciler` roda **1x ao iniciar o app** + **1x ao dia**:

```
para cada task atribuída a 'me' e não arquivada:
   hash_atual = TaskToEventMapper.hash(task)
   proj = projection[task.id]
   se proj não existe OU proj.last_synced_hash != hash_atual:
       enqueue 'upsert'           ← deixa o Drainer fazer o I/O
para cada projection cuja task não está ativa atribuída a 'me':
   enqueue 'cancel'
```

O Reconciler **só enfileira**, nunca chama Google → canal único de I/O.

## 9. OAuth 2.0 (desktop app)

- **Fluxo loopback IP** (`http://127.0.0.1:{porta}/callback`) — recomendado pelo Google para apps instalados; sem `client_secret` no cliente.
- **Escopo:** `https://www.googleapis.com/auth/calendar.events` (apenas eventos, não a agenda inteira).
- **Tauri:** `tauri-plugin-shell` abre o browser do sistema; servidor HTTP efêmero na porta captura o `code`; troca por `access_token` + `refresh_token`.
- **TokenStore:** OS keychain (Credential Manager no Windows) via `tauri-plugin-stronghold` ou `keytar`. Refresh token **nunca** em texto plano no SQLite.
- **Desconectar:** apaga tokens. Cancelamento dos eventos existentes na projection é opcional (toggle em Settings).

## 10. Tratamento de erros

| Cenário | Ação |
|---|---|
| Sem refresh token | item permanece `pending`, não vira `dead`; reconexão OAuth reativa |
| `access_token` expirado | refresh transparente; refresh inválido → marca desconectado, notifica UI |
| Offline / rede | `pending` + `next_retry_at` (backoff: 30s, 1m, 5m, 15m… cap 1h) |
| `429` rate limit | respeita cabeçalho `Retry-After` |
| `403` quota excedida | `dead` + alerta na Settings |
| `404` no cancel (já removido) | sucesso idempotente |
| `409` / ETag conflito | re-busca evento, atualiza projection |
| App fecha durante o drain | `in_flight` → próximo tick reprocessa (idempotente por ETag) |

## 11. Testes (TDD)

- **Domain:** sem mudanças (regra do projeto preservada).
- **TaskToEventMapper** (puro): casos `unico` / `periodo` / `recorrente` / sem-prazo → snapshot do Event gerado.
- **CalendarIntegrationService:** enqueue gera a op correta por Use Case; `cancel` ao desatribuir; no-op quando Google desconectado.
- **CalendarOutboxDrainer:** com `TokenStore` fake + `CalendarGateway` fake (registro de chamadas); cenários sucesso / falha / backoff / `dead`. Sem rede real.
- **CalendarReconciler:** diferenças de hash geram enqueue; órfãos geram cancel.
- **GoogleCalendarAdapter:** testes de contrato com respostas HTTP mockadas (sem rede).

## 12. Fora de escopo (YAGNI)

- ❌ Bidirecional (Google → app)
- ❌ Multi-agenda (apenas `primary`)
- ❌ Convidar outros usuários como attendees (lembrete pessoal)
- ❌ Server-side / Supabase Edge Function (decisão: cliente local)
- ❌ Publicação na agenda de terceiros

## 13. Riscos & mitigações

| Risco | Mitigação |
|---|---|
| Token vazado no SQLite | TokenStore via OS keychain; refresh token nunca em texto plano |
| Cota do Google estourada | Hash canônico + Reconciler só-enfileira + backoff; alerta em `dead` |
| Publicação duplicada após crash | ETag + `google_event_id` persistido → `upsert` idempotente |
| Usuário sem e-mail Google válido | Gate de conexão: OAuth falha limpa → estado "desconectado" |
| Múltiplas máquinas do mesmo usuário | Cada máquina tem próprio outbox + projection; idempotência por ETag evita duplicidade |
