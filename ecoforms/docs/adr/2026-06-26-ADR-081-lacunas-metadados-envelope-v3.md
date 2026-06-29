# ADR-081 — Lacunas de Metadados do Envelope (proposta v3)

**Status:** Proposto
**Data:** 2026-06-26
**Relacionado:** ADR-064 (event-sourcing/mesh), ADR-074 (cofre de chaves), ADR-079 (config portátil), ADR-080 (PocketBase hub — proposto)
**Referência viva:** `docs/sync/sync-envelopes.html` (mapa dos formatos atuais)

---

## Contexto

O `EventEnvelope` v2 (`packages/core/src/sync/EventEnvelope.ts`) cobre bem **roteamento** (`routing_*`) e
**ordenação linear** (`seq`, `prev_event_id`) — suficiente para sync 1↔nuvem. Mas a trajetória atual
(mesh multi-instância + relay PocketBase + storage de fotos + rotação de chave) expõe lacunas de metadados que
**só viram problema fora do 1↔nuvem** — e o custo de adicioná-las cresce com o volume de eventos já cifrados.

Apuração completa dos formatos: ver `sync-envelopes.html`.

## Decisão

Adotar **`EventEnvelope` v3 — aditivo** (campos novos, opcionais na leitura para tolerar eventos v2 antigos), e
**unificar no envelope do core (A)** antes de adicionar transportes. Os campos:

| Campo novo | Resolve | Prioridade |
|---|---|---|
| `enc: { alg, key_epoch }` | ciphertext órfão após rotação de chave (há `sync_salt_history`) | 🔴 |
| `hlc: string` (Hybrid Logical Clock) | LWW determinístico sem depender de relógio de parede | 🔴 |
| `actor_id: string \| null` | auditoria/LGPD, RBAC no replay, "config segue o usuário" | 🔴 |
| `org_id: string` | particionamento/isolamento num hub compartilhado ("everyone") | 🟡 |
| `attachments: [{ hash, mime, size, ref }]` | ligação evento ↔ blob (plano de fotos PocketBase, GC por hash) | 🟡 |
| `schema_version` **por tipo de evento** | import/replay degradar com elegância (ADR-079) | 🟡 |
| `op: 'create'\|'update'\|'delete'` | tombstones, compactação de snapshot, GC | ⚪ |

### Integridade & autenticidade

- **Hoje:** `checksum = sha256(stableStringify(data))` — cobre **só `data`**. Metadados (`type`, `routing_id`,
  `aggregate`, `seq`…) ficam **desprotegidos**; um relay corrompido/adulterado não é detectado.
- **v3:** o checksum passa a cobrir um **core canônico de metadados + data**
  (`{type, routing_id, routing_type, aggregate, seq, prev_event_id, actor_id, data}` via `stableStringify`).
- **Opcional (hub não confiável):** `sig` (HMAC/assinatura) ligando o evento ao emissor — decisão de ameaça
  declarada explicitamente (em LAN confiável pode ficar fora; num "everyone" aberto, entra).

### Esboço do v3

```jsonc
{
  "v": 3,
  "id": "uuidv7",
  "type": "task.arquivada",
  "schema_version": 2,                 // agora versiona o PAYLOAD do tipo
  "org_id": "...",                     // novo
  "actor_id": "user-uuid | null",      // novo
  "source": { "device_id": "...", "routing_id": "...", "routing_type": "setor|user", "app_version": "..." },
  "aggregate": { "type": "task", "id": "uuid" },
  "op": "update",                      // novo (opcional)
  "time": "ISO",                       // mantido (observabilidade)
  "hlc": "2026-06-26T...-000042-deviceA", // novo: desempate determinístico
  "seq": 0,
  "prev_event_id": null,
  "correlation_id": null,
  "causation_id": null,
  "attachments": [                     // novo (quando houver binários)
    { "hash": "sha256:...", "mime": "image/jpeg", "size": 12345, "ref": "pb:anexos/<id>" }
  ],
  "enc": { "alg": "AES-256-GCM", "key_epoch": 3 },  // novo
  "data": { },
  "checksum": "sha256:<core+data>"     // escopo ampliado
}
```

## Consequências

**Positivas**
- Ciphertext continua decifrável após rotação (`key_epoch`).
- Convergência determinística (HLC) independente de NTP na LAN.
- Auditoria/RBAC/“segue o usuário” com `actor_id` de primeira classe.
- Plano de fotos uniforme (`attachments[]` ↔ `anexos_cache`/PocketBase).
- Import/replay versionado por tipo; isolamento por `org_id` no hub.

**Custos / riscos**
- **Quebra de checksum:** mudar o escopo do checksum é incompatível byte-a-byte com v2. Mitigação: o leitor
  aceita `v:2` (checksum antigo, só `data`) **e** `v:3` (checksum novo); `seal/verify` ramifica por `v`.
- Exige um **HLC** compartilhado (desktop TS + mobile JS, bit-compatível como o `stable-stringify`).
- `attachments`/`enc` exigem coordenação com o storage de blobs e o `KeyRotationService`.

## Alternativas rejeitadas

- **Manter v2 e meter tudo dentro de `data`.** É o que acontece hoje com `criado_por` — vira metadado
  informal, não filtrável/auditável/protegido pelo contrato. Rejeitado: reabre a fábrica de drift.
- **LWW só por `time`.** Não-determinístico entre relógios divergentes; inaceitável para convergência.

## Migração

1. Unificar nos **dois** `EcoFormsEventTypes` e remover o `EventEnvelope` divergente do desktop (campo
   `stream_id` + tipo frouxo) — pré-requisito; ver `sync-envelopes.html` (divergência A vs B).
2. Introduzir v3 como **aditivo**, com `createEnvelope`/`sealEnvelope`/`verify` ramificando por `v`.
3. Decidir **agora** (antes do hub) ao menos `enc.key_epoch` e `hlc` — adicioná-los depois de milhões de
   eventos cifrados é caro. `actor_id`/`org_id`/`attachments` podem entrar junto, pois são puramente aditivos.

## Não-objetivos

- Não exige reescrever handlers nem o pipeline — handlers ignoram campos que não conhecem.
- Não decide o transporte (isso é o ADR-080); aqui é só o **formato/contrato** do envelope.
