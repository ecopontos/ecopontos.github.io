# ADR-080 — PocketBase como Hub de Sync LAN (relay de eventos + storage de anexos)

**Status:** Proposto
**Data:** 2026-06-27
**Relacionado:** ADR-027 (LAN sync), ADR-031 (LAN fetch), ADR-064 (event-sourcing/mesh), ADR-074 (cofre de chaves), ADR-079 (config portátil), ADR-081 (envelope v3)
**Referência viva:** `docs/sync/sync-envelopes.html`

---

## Contexto

Não há banco de dados central. A geografia da organização não respeita as pastas departamentadas, e há a
intenção (pedido à TI) de liberar uma pasta de rede compartilhada onde **arquivos e um PocketBase** possam
existir para todos. O app é offline-first e já tem **todo o lado-cliente de sync por LAN** pronto —
`LanTransport`, `LanPullService`, `fila_eventos_lan`, `getLanTransport()` — pressuposto pelos ADR-027/064. O que
falta é o **servidor** do outro lado.

## Decisão

Adotar **PocketBase como o hub de sync na LAN** — a materialização concreta do hub que os ADR-027/064 já
pressupunham. É uma **troca de transporte sob o mesmo `EventEnvelope`**, não um rewrite.

### Regras inegociáveis

1. **PocketBase é um servidor, não um arquivo de banco compartilhado.** Um host roda `pocketbase serve`
   (o data dir pode ficar na pasta de rede para backup); **todos os clientes falam HTTP**. Nunca abrir o
   `.sqlite` do PocketBase direto pelo compartilhamento (SQLite sobre SMB/NFS com escritores concorrentes
   **corrompe**).

2. **Guardar o dado no formato em que ele já viaja — não re-modelar o schema relacional.** A estrutura continua
   definida **uma vez só** no app (`ensure-columns.ts`). O PocketBase trata o conteúdo como **opaco** e indexa
   só os metadados de rota. Re-modelar tabelas como coleções reabriria a fábrica de duplicação/drift.

3. **Import/aplicação sempre pelo contrato de eventos** (`HandlerRegistry`), nunca escrevendo direto no SQLite
   local — preserva idempotência, `ConflictResolver` e roteamento.

### Três coleções (PocketBase não conhece o schema do app)

| Coleção | Conteúdo | Indexa |
|---|---|---|
| `eventos` | o `EventEnvelope` (texto JSON) num campo + payload cifrado | `routing_id`, `routing_type`, `seq`, `aggregate_id` |
| `snapshots` | os JSON que já existem (`users.json`, `tasks.json`…) | `kind`, `routing_id`, versão |
| `anexos` | campo `file` (a foto) + metadados | `hash`, `setor_id` |

### Dados estruturados — SQLite manda, PocketBase distribui

O SQLite local é a fonte de verdade (réplica completa em cada instância). O **outbox** (`fila_eventos_sync`/
`fila_eventos_lan`) decide *o que enviar e para quem* (a rota já está no envelope); o PocketBase é o **comutador**
que entrega (pull ou realtime/SSE, filtrado por API Rules conforme a rota).

### Fotos — vivem uma vez no PocketBase, referência viaja

Binário pesado **não** é replicado para toda instância:
- a foto vive **uma vez** no storage do PocketBase (`anexos.file`, com thumbnails e rules por setor/user);
- o SQLite local guarda **só a referência** (`anexos.caminho_storage` = id/URL do PocketBase);
- outras instâncias recebem a referência (evento `ecoforms.anexo.criado`, já no contrato) e **buscam a imagem
  sob demanda**, cacheando localmente.

Isto **reanima `anexos_cache`/`anexos_refs`** (hash, `ref_count`, `accessed_at`, índice de GC `ref_count <= 0`),
que estavam mortas por falta de um storage central. Identidade da foto por **hash de conteúdo** → dedup; GC por
`ref_count`; evicção do cache local por `accessed_at`.

### Controle de acesso: sobe para o contrato, não para a pasta

Permissão de pasta NTFS é rígida e amarrada à topologia. Aqui o acesso é por **API Rules por coleção** do
PocketBase + o roteamento `setor/user` do envelope + o RBAC existente. Uma pasta "everyone" plana com
visibilidade controlada no nível do evento resolve a geografia sem espelhar o organograma em permissões de pasta.

### Texto JSON na rede (não JSONB)

PocketBase = SQLite; o campo `json` é TEXT e a API serve texto. JSONB não dá ganho no fluxo de passagem e
**quebraria a regra do checksum** (`sha256(stableStringify)` precisa ser bit-idêntico desktop↔mobile). A
performance vem de **indexar as colunas de rota/seq**, não do tipo do JSON. (JSONB só faria sentido em projeções
de relatório read-only ou se a nuvem fosse Postgres.)

## Consequências

**Positivas**
- Funciona na LAN sem internet (casa com o offline-first); remoto/nuvem usa a **mesma** API/formato.
- Remove dependência do Supabase para o sync operacional (transporte trocável → é só desligar um).
- Operação simples (um binário, SQLite embutido, admin UI, realtime SSE).
- Fotos fora do peso da replicação total; `anexos_cache`/`anexos_refs` ganham propósito.

**Custos / riscos**
- **Host único = ponto de falha.** Mitigado pelo offline-first (eventos enfileiram em `fila_eventos_lan` e
  sincronizam quando o hub volta) + backup do data dir.
- **Ownership operacional:** o host precisa de dono (uptime, backup).
- **Autenticidade num "everyone":** ver ADR-081 (`sig`/HMAC) — decisão de ameaça a declarar.

## Decisões a fechar (deliberadas)

1. **Auth:** PocketBase auth **substitui** a Supabase Auth (menos peças) ou convive? Tendência: substituir.
2. **Criptografia na LAN:** manter AES-GCM (zero-trust) ou relaxar em rede confiável? Recomendo manter +
   `enc.key_epoch` (ADR-081) para sobreviver à rotação.
3. **Aposentadoria do Supabase Storage** como transporte operacional (vira opcional/externo).
4. **Envelope canônico:** adotar o **core (A)** e eliminar o `EventEnvelope` divergente do desktop (ADR-081).

## Alternativas rejeitadas

- **Re-modelar o schema relacional em coleções PocketBase.** Mantém estrutura em dois lugares → drift. Só como
  projeção read-only para relatório, jamais como fonte de verdade.
- **SQLite do PocketBase aberto direto pela pasta de rede.** Corrompe sob concorrência. Rejeitado.
- **"Carregar config" só pelo bucket de sync.** Não atende offline/sneakernet (é o papel do ADR-079, complementar).

## Sequência recomendada

1. (feito) Recuperar o build — `main` íntegro.
2. **Este ADR:** hub como troca de transporte (`eventos`/`snapshots`/`anexos`), plugando `LanTransport`/
   `LanPullService` no PocketBase.
3. Fotos no storage do PocketBase reanimando o cache de anexos.
4. ADR-079 (bundle de config) como complemento offline/template.

(ADR-081 — campos v3 do envelope, sobretudo `enc.key_epoch` e `hlc` — deve ser decidido **antes** de acumular
eventos cifrados no hub.)
