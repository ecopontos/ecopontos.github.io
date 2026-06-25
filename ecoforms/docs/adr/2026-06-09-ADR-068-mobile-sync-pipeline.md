# ADR-068 ÔÇö Pipeline de Sincroniza├º├úo do Mobile


> **Renumerado** de ADR-056 para ADR-068 em 2026-06-18 (triagem de ADRs — série `desktop/docs/adr/` consolidada em `docs/adr/`).


**Status:** Decidido  
**Data:** 2026-06-09  
**Autor:** Marcelo Luiz  
**Branch:** gaps-90-92-93-fix  
**Contexto externo:** #89 ÔÇö submiss├Áes mobile ficam retidas em IndexedDB; US-04/US-05 de Coleta em Campo dependem deste pipeline.

---

## Contexto

### O que existe hoje

O mobile standalone (`mobile_standalone/www/js/`) j├í possui infraestrutura parcial de sync:

| Componente | Status | Descri├º├úo |
|---|---|---|
| `DataService.saveFormData()` | Ô£à | Salva submiss├úo em IndexedDB com `syncStatus: 'pending'` |
| `DataService._publishFormEvent()` | Ô£à | Publica evento de formul├írio via `SyncAdapter` |
| `DataService.uploadFilesInRecord()` | Ô£à | Upload de bin├írios para `sync-bucket` |
| `DataService.syncSingleRecord()` | ÔÜá´©Å | Depreciado ÔÇö redireciona para `_publishFormEvent()` |
| `window.syncAdapter.syncNow()` | Ô£à | Exposto mas sem chamador autom├ítico |
| `IndexedDB.syncIdempotency` | Ô£à | Object store para dedup de eventos |
| Background service worker | ÔØî | N├úo existe ÔÇö `syncNow()` n├úo ├® acionado automaticamente |
| Pipeline eventos ÔåÆ Supabase | ÔØî | `_publishFormEvent` escreve no `SyncAdapter` mas n├úo h├í transporte real para Supabase |
| Reconcilia├º├úo multi-device | ÔØî | S├│ ecoponto reconcilia (US-05); demais submiss├Áes nunca chegam ao desktop |

### Problema

Submiss├Áes offline (`syncStatus: 'pending'`) acumulam em IndexedDB. Quando a rede volta, **nada** dispara `syncAdapter.syncNow()`. O usu├írio precisa:
1. Perceber que est├í online
2. Recarregar a p├ígina manualmente
3. Torcer para o handler `onFocus` da p├ígina disparar o sync

Resultado: formul├írios preenchidos em campo nunca chegam ao desktop para processamento (exceto ecopontos, que t├¬m reconcilia├º├úo dedicada em US-05).

---

## Decis├úo

### Transporte: Supabase Storage ÔåÆ Supabase Database (event sourcing)

O mobile publica eventos de formul├írio em `sync-bucket/submissions/{uuid}.json` (Storage). Um webhook/trigger no Supabase l├¬ o arquivo e insere na tabela `tbl_form_submissions` com valida├º├úo de schema.

```
Mobile (offline)
  ÔåÆ IndexedDB (syncStatus: pending)
  ÔåÆ [rede volta]
  ÔåÆ SyncAdapter.syncNow()
  ÔåÆ upload arquivo ÔåÆ sync-bucket/submissions/{uuid}.json
  ÔåÆ Supabase Storage Trigger ÔåÆ valida schema ÔåÆ INSERT tbl_form_submissions
  ÔåÆ Desktop pull (ADR-027 LAN sync) ou query direta do Supabase
```

**Por que Storage e n├úo API REST direta?**
- Mobile j├í autentica contra Supabase (US-02) ÔÇö token JWT v├ílido
- Storage aceita uploads grandes com bin├írios inline (fotos, anexos)
- Mesmo bucket (`sync-bucket`) j├í usado para `form_registry.json` e `form_schema_registry.json`
- Trigger server-side valida schema ÔÇö mobile n├úo precisa de l├│gica de valida├º├úo complexa

### Mecanismo de disparo

| Gatilho | Quando | Handler |
|---|---|---|
| `window.addEventListener('online')` | Browser detecta rede | `syncAdapter.syncNow()` |
| `ServiceWorker.periodicSync` | Background, a cada ~15min (Android) | `syncAdapter.syncNow()` |
| `PageVisibility` / `onFocus` | Usu├írio retorna ao app | `syncAdapter.syncNow()` + debounce 30s |
| Bot├úo manual "Sincronizar" | Usu├írio expl├¡cito | `syncAdapter.syncNow()` sem debounce |

### Resolu├º├úo de conflitos: Last Write Wins por `updated_at`

Se dois devices submeterem o mesmo `uuid`, o Supabase trigger usa `ON CONFLICT (uuid) DO UPDATE` apenas se o `updated_at` do novo registro for mais recente.

```sql
INSERT INTO tbl_form_submissions (uuid, form_id, data, updated_at)
VALUES (NEW.uuid, NEW.form_id, NEW.data, NEW.updated_at)
ON CONFLICT (uuid) DO UPDATE
  SET data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
  WHERE tbl_form_submissions.updated_at < EXCLUDED.updated_at;
```

### Idempot├¬ncia

`syncIdempotency` store no IndexedDB mant├®m `{ eventId, syncAttemptTime }`. Antes de cada push, `SyncAdapter` verifica se o `eventId` j├í foi enviado com sucesso (HTTP 200/201). Se sim, pula. Se falhou (erro de rede), reenvia.

### Retry

- **Backoff exponencial**: 1s ÔåÆ 2s ÔåÆ 4s ÔåÆ 8s ÔåÆ 16s ÔåÆ 32s (cap)
- **M├íximo de retries**: 5 por registro
- **Falha permanente**: marca `syncStatus: 'error'` + `syncError: mensagem`. Vis├¡vel no painel "Pend├¬ncias" do mobile.

---

## Implementa├º├úo ÔÇö fases

### Fase 1 ÔÇö Service Worker para periodic sync Ô£à (escopo imediato)

| Arquivo | Mudan├ºa |
|---|---|
| `mobile_standalone/service-worker.js` | Registrar listener `periodicsync` ÔåÆ `syncAdapter.syncNow()` |
| `mobile_standalone/www/js/sync/SyncAdapter.js` | Extrair de `data-service.js` como m├│dulo independente |
| `mobile_standalone/www/js/sync/OnlineDetector.js` | Novo ÔÇö listeners `online`/`offline` + `PageVisibility` |
| `mobile_standalone/www/js/app.js` | Inicializar `OnlineDetector` no boot |

### Fase 2 ÔÇö Transporte real para Supabase

| Arquivo | Mudan├ºa |
|---|---|
| `mobile_standalone/www/js/data-service.js` | `_publishFormEvent` grava no Storage `sync-bucket/submissions/` |
| `supabase/migrations/xxx_form_submissions_trigger.sql` | Trigger que l├¬ Storage ÔåÆ valida schema ÔåÆ INSERT |
| `supabase/migrations/xxx_form_submissions_table.sql` | Tabela `tbl_form_submissions` com schema |

### Fase 3 ÔÇö Painel de pend├¬ncias no mobile

| Arquivo | Mudan├ºa |
|---|---|
| `mobile_standalone/www/pages/pendencias.html` | Nova p├ígina ÔÇö lista registros com `syncStatus: 'pending'/'error'` |
| `mobile_standalone/www/js/ui/PendingSyncPanel.js` | Componente ÔÇö retry individual, dismiss, detalhes do erro |

---

## O que N├âO faz parte deste ADR

- **LAN sync no mobile** ÔÇö O APK n├úo participa do ciclo LAN (ADR-027). O sync ├® sempre mobileÔåÆSupabaseÔåÆdesktop.
- **Pull do Supabase para mobile** ÔÇö O mobile n├úo recebe dados do desktop. S├│ envia submiss├Áes. O desktop ├® o consumidor.
- **Criptografia de sync** ÔÇö A chave PBKDF2 (US-03) j├í ├® derivada. A cifragem dos eventos no bucket ser├í tratada em ADR futuro quando houver dados sens├¡veis em formul├írios de campo.
- **Conflitos merge-aware** ÔÇö LWW ├® suficiente para formul├írios (escrita ├║nica por agente). CRDT seria overdesign.

---

## Rastreabilidade

| User Story | Cobertura |
|---|---|
| US-04 (Coleta) ÔÇö Salvar submiss├úo offline | Fase 1 + 2: o que est├í em IndexedDB chega ao Supabase |
| US-05 (Coleta) ÔÇö Ocupa├º├úo de ecoponto | J├í funciona ÔÇö reconcilia├º├úo dedicada n├úo depende deste pipeline |
| US-06 (Coleta) ÔÇö Upload de fotos | Fase 2: bin├írios v├úo junto no payload do Storage |
| US-03 (Auth) ÔÇö Chave PBKDF2 | Pr├®-requisito atendido; cifragem adiada para ADR futuro |
