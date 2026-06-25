# ADR-056 — Pipeline de Sincronização do Mobile

**Status:** Decidido  
**Data:** 2026-06-09  
**Autor:** Marcelo Luiz  
**Branch:** gaps-90-92-93-fix  
**Contexto externo:** #89 — submissões mobile ficam retidas em IndexedDB; US-04/US-05 de Coleta em Campo dependem deste pipeline.

---

## Contexto

### O que existe hoje

O mobile standalone (`mobile_standalone/www/js/`) já possui infraestrutura parcial de sync:

| Componente | Status | Descrição |
|---|---|---|
| `DataService.saveFormData()` | ✅ | Salva submissão em IndexedDB com `syncStatus: 'pending'` |
| `DataService._publishFormEvent()` | ✅ | Publica evento de formulário via `SyncAdapter` |
| `DataService.uploadFilesInRecord()` | ✅ | Upload de binários para `sync-bucket` |
| `DataService.syncSingleRecord()` | ⚠️ | Depreciado — redireciona para `_publishFormEvent()` |
| `window.syncAdapter.syncNow()` | ✅ | Exposto mas sem chamador automático |
| `IndexedDB.syncIdempotency` | ✅ | Object store para dedup de eventos |
| Background service worker | ❌ | Não existe — `syncNow()` não é acionado automaticamente |
| Pipeline eventos → Supabase | ❌ | `_publishFormEvent` escreve no `SyncAdapter` mas não há transporte real para Supabase |
| Reconciliação multi-device | ❌ | Só ecoponto reconcilia (US-05); demais submissões nunca chegam ao desktop |

### Problema

Submissões offline (`syncStatus: 'pending'`) acumulam em IndexedDB. Quando a rede volta, **nada** dispara `syncAdapter.syncNow()`. O usuário precisa:
1. Perceber que está online
2. Recarregar a página manualmente
3. Torcer para o handler `onFocus` da página disparar o sync

Resultado: formulários preenchidos em campo nunca chegam ao desktop para processamento (exceto ecopontos, que têm reconciliação dedicada em US-05).

---

## Decisão

### Transporte: Supabase Storage → Supabase Database (event sourcing)

O mobile publica eventos de formulário em `sync-bucket/submissions/{uuid}.json` (Storage). Um webhook/trigger no Supabase lê o arquivo e insere na tabela `tbl_form_submissions` com validação de schema.

```
Mobile (offline)
  → IndexedDB (syncStatus: pending)
  → [rede volta]
  → SyncAdapter.syncNow()
  → upload arquivo → sync-bucket/submissions/{uuid}.json
  → Supabase Storage Trigger → valida schema → INSERT tbl_form_submissions
  → Desktop pull (ADR-027 LAN sync) ou query direta do Supabase
```

**Por que Storage e não API REST direta?**
- Mobile já autentica contra Supabase (US-02) — token JWT válido
- Storage aceita uploads grandes com binários inline (fotos, anexos)
- Mesmo bucket (`sync-bucket`) já usado para `form_registry.json` e `form_schema_registry.json`
- Trigger server-side valida schema — mobile não precisa de lógica de validação complexa

### Mecanismo de disparo

| Gatilho | Quando | Handler |
|---|---|---|
| `window.addEventListener('online')` | Browser detecta rede | `syncAdapter.syncNow()` |
| `ServiceWorker.periodicSync` | Background, a cada ~15min (Android) | `syncAdapter.syncNow()` |
| `PageVisibility` / `onFocus` | Usuário retorna ao app | `syncAdapter.syncNow()` + debounce 30s |
| Botão manual "Sincronizar" | Usuário explícito | `syncAdapter.syncNow()` sem debounce |

### Resolução de conflitos: Last Write Wins por `updated_at`

Se dois devices submeterem o mesmo `uuid`, o Supabase trigger usa `ON CONFLICT (uuid) DO UPDATE` apenas se o `updated_at` do novo registro for mais recente.

```sql
INSERT INTO tbl_form_submissions (uuid, form_id, data, updated_at)
VALUES (NEW.uuid, NEW.form_id, NEW.data, NEW.updated_at)
ON CONFLICT (uuid) DO UPDATE
  SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
  WHERE tbl_form_submissions.updated_at < EXCLUDED.updated_at;
```

### Idempotência

`syncIdempotency` store no IndexedDB mantém `{ eventId, syncAttemptTime }`. Antes de cada push, `SyncAdapter` verifica se o `eventId` já foi enviado com sucesso (HTTP 200/201). Se sim, pula. Se falhou (erro de rede), reenvia.

### Retry

- **Backoff exponencial**: 1s → 2s → 4s → 8s → 16s → 32s (cap)
- **Máximo de retries**: 5 por registro
- **Falha permanente**: marca `syncStatus: 'error'` + `syncError: mensagem`. Visível no painel "Pendências" do mobile.

---

## Implementação — fases

### Fase 1 — Service Worker para periodic sync ✅ (escopo imediato)

| Arquivo | Mudança |
|---|---|
| `mobile_standalone/service-worker.js` | Registrar listener `periodicsync` → `syncAdapter.syncNow()` |
| `mobile_standalone/www/js/sync/SyncAdapter.js` | Extrair de `data-service.js` como módulo independente |
| `mobile_standalone/www/js/sync/OnlineDetector.js` | Novo — listeners `online`/`offline` + `PageVisibility` |
| `mobile_standalone/www/js/app.js` | Inicializar `OnlineDetector` no boot |

### Fase 2 — Transporte real para Supabase

| Arquivo | Mudança |
|---|---|
| `mobile_standalone/www/js/data-service.js` | `_publishFormEvent` grava no Storage `sync-bucket/submissions/` |
| `supabase/migrations/xxx_form_submissions_trigger.sql` | Trigger que lê Storage → valida schema → INSERT |
| `supabase/migrations/xxx_form_submissions_table.sql` | Tabela `tbl_form_submissions` com schema |

### Fase 3 — Painel de pendências no mobile

| Arquivo | Mudança |
|---|---|
| `mobile_standalone/www/pages/pendencias.html` | Nova página — lista registros com `syncStatus: 'pending'/'error'` |
| `mobile_standalone/www/js/ui/PendingSyncPanel.js` | Componente — retry individual, dismiss, detalhes do erro |

---

## O que NÃO faz parte deste ADR

- **LAN sync no mobile** — O APK não participa do ciclo LAN (ADR-027). O sync é sempre mobile→Supabase→desktop.
- **Pull do Supabase para mobile** — O mobile não recebe dados do desktop. Só envia submissões. O desktop é o consumidor.
- **Criptografia de sync** — A chave PBKDF2 (US-03) já é derivada. A cifragem dos eventos no bucket será tratada em ADR futuro quando houver dados sensíveis em formulários de campo.
- **Conflitos merge-aware** — LWW é suficiente para formulários (escrita única por agente). CRDT seria overdesign.

---

## Rastreabilidade

| User Story | Cobertura |
|---|---|
| US-04 (Coleta) — Salvar submissão offline | Fase 1 + 2: o que está em IndexedDB chega ao Supabase |
| US-05 (Coleta) — Ocupação de ecoponto | Já funciona — reconciliação dedicada não depende deste pipeline |
| US-06 (Coleta) — Upload de fotos | Fase 2: binários vão junto no payload do Storage |
| US-03 (Auth) — Chave PBKDF2 | Pré-requisito atendido; cifragem adiada para ADR futuro |
