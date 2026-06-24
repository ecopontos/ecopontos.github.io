# ADR-064 — Arquitetura de Sincronizacao Consolidada (Event Sourcing + REST Mesh LAN)

**Status:**Decidido** (revisão técnica pendente — ver seção "Bloqueadores de aceitação (B1-B5)
**Data:** 2026-06-18
**Atualizado:** 2026-06-18 (triagem de ADRs — incorporação dos bloqueadores B1-B5 da revisão técnica `REV-ADR-064`)
**Consolida:** ADR-063 (P2P Mesh Sync LAN — transporte) `[ARQUIVO INEXISTENTE — referência histórica; ADR-063 nunca foi escrito como arquivo, sua modelagem está absorvida na seção "Componentes §3" deste ADR]` + rascunho "ADR-001" (event sourcing + libp2p/IPFS — modelo de dados) `[ARQUIVO INEXISTENTE — rascunho absorbido; transporte libp2p/IPFS explicitamente descartado, ver seção "Descartado"]`
**Relacao com ADR-063:** ADR-063 passa a ser a **camada de transporte** sob este ADR. Sua escolha de modelo de dados (snapshot LWW por entidade) e **superada** pelo event sourcing definido aqui.

---

## Contexto

A discussao convergiu para duas propostas concorrentes no mesmo espaco de problema:

- **ADR-063 (Barra 4)** — mesh P2P sobre HTTP/TLS com descoberta mDNS, reaproveitando o modelo de snapshots da Barra 3 (LWW por `last_event_id`).
- **Rascunho "ADR-001"** — event sourcing pleno (events como fonte canonica + projecoes), HLC para conflito, libp2p como transporte, WebTorrent/IPFS para blobs.

Nenhuma das duas, pura, e a mais adequada. A constatacao central: **transporte e modelo de dados sao eixos ortogonais** — da para escolher o melhor de cada.

### Restricoes operacionais (herdadas do ADR-063)

1. Sem DB server central.
2. Sem host central de qualquer tipo (sem NAS, sem file server SMB).
3. Sem nuvem — rede pode ser 100% isolada.
4. Dispositivos: desktops Tauri (Windows/Linux) + mobiles Capacitor (Android).
5. Sempre ha >=1 desktop Tauri ligado quando sync e necessaria.
6. Volume de dados estruturados pequeno / esporadico.
7. Comunicacao TLS + token compartilhado (rede nao confiavel).

### Requisitos confirmados nesta decisao

8. **Auditoria/historico imutavel e requisito obrigatorio** — precisa reconstruir estado e autoria ao longo do tempo. Isso elimina o modelo de snapshot puro (snapshot nao guarda historico) e torna **event sourcing obrigatorio**, nao opcional.
9. **Anexos (blobs) muitos e/ou grandes** — servir todos a partir de um unico desktop ancora vira gargalo de banda e ponto unico de disponibilidade. Exige distribuicao de blobs entre multiplos holders.

### Estado atual do codigo (auditado)

- Nao existe tabela `events` canonica. Existe `fila_eventos_sync` (`fila_eventos_sync`) — uma **fila** de sync, nao um event store. Tabelas de dominio sao a verdade; eventos sao espelho (padrao outbox/inbox).
- Nao ha HLC, `author_seq` nem `topic_id` no codigo.
- Nao ha `libp2p`, `webtorrent` nem `ipfs` em nenhum `package.json`.
- Hash de snapshot usa `JSON.stringify` nao-estavel (`LanDomainSyncService.ts:53`); `stableStringify` existe em `ecoforms-core` (raiz) e e usado em `EventEnvelope.ts`.
- **Transporte de eventos e plugavel** (2026-06-18): `SyncEventIndexPort` (interface em `ecoforms-core`) abstraia `pushEvent`/`pullEvents`. A implementacao concreta (`createSupabaseSyncEventIndex`) foi isolada em `SyncEventIndexFactory` (`lazy-sync.ts`), trocavel via `setSyncEventIndexFactory()` ou `ContainerBootstrapOptions`. `TransportService`, `InboundService`, `SyncOutbox`, `HandlerRegistry` e todos os use cases **nao conhecem** o backend — operam sobre a interface. Contrato documentado em `docs/SYNC-TRANSPORT-CONTRACT.md`.

Conclusao: o **modelo de dados** (event sourcing, HLC, projecoes) e greenfield. O **transporte** ja esta desacoplado — uma implementacao LAN do `SyncEventIndexPort` e o unico artefato faltante para F2.

---

## Decisao

Adotar arquitetura em **tres camadas**, escolhendo o melhor de cada ADR:

| Camada | Escolha | Origem |
|---|---|---|
| **Modelo de dados** | Event sourcing: `events` como fonte canonica imutavel + projecoes materializadas. Conflito por **HLC**. | rascunho ADR-001 |
| **Transporte de eventos** | HTTP/TLS REST mesh + descoberta mDNS. Eventos sao pequenos e estruturados. | ADR-063 |
| **Transporte de blobs** | **Content-addressed multi-source HTTP** (ID = SHA-256, por *range*, de qualquer peer que tenha o blob; descoberta pela lista mDNS ja existente). | meio-termo |

### Princípios

1. **Eventos sao a unidade atomica de sync e a fonte da verdade.** Tabelas de dominio (`tarefas`, `demandas`, etc.) viram projecoes materializadas, reconstruidas deterministicamente a partir do log de eventos.
2. **Transporte simples e debugavel.** REST sobre TLS, sem libp2p — a malha e pequena, isolada e tem peer-set conhecido via mDNS. libp2p resolve problemas (NAT traversal, descoberta internet-scale, malha dinamica grande) que este cenario nao tem.
3. **Blobs distribuidos sem DHT.** O peer-set ja e conhecido por mDNS; nao se precisa de DHT (IPFS/WebTorrent) para descobrir holders. Content-addressing por SHA-256 (igual ao `.enc` atual) + fetch multi-source por *range* = distribuicao tipo-swarm com infraestrutura minima.
4. **Desktop = no ancora / arquivo completo. Mobile = peer leve.** O ancora mantem o log de eventos completo e imutavel (o arquivo de auditoria). Mobile mantem projecoes + cauda recente de eventos.
5. **TLS + token + assinatura de eventos.** Como auditoria e requisito, cada evento e assinado pelo device de origem — sem isso, um peer com o token poderia forjar historico.
6. **Graceful degradation mantido.** Sem peers visiveis → no-op silencioso; sync legado segue como transporte de transicao.

---

## Componentes

### 1. Event Store canonico (modelo de dados)

- Nova tabela `events`: append-only, imutavel. Colunas minimas: `event_id` (uuidv7), `topic_id`, `author_device_id`, `author_seq`, `hlc_timestamp`, `aggregate_type`, `aggregate_id`, `event_type`, `payload`, `payload_hash`, `signature`, `created_at`.
- Tabelas de dominio atuais viram **projecoes materializadas**, reconstruidas por *replay* deterministico dos eventos.
- Handlers de mutacao gravam **evento primeiro**, derivam projecao depois.
- Hash de payload usa `stableStringify` (nao `JSON.stringify`) — hash bit-identico cross-plataforma.

### 2. HLC (Hybrid Logical Clock) — ordem e conflito

- Cada evento carrega `hlc_timestamp` = relogio fisico + contador logico + `device_id` como desempate.
- Resiste a relogios de celular incorretos; garante ordem causal (A causou B → HLC(A) < HLC(B)).
- Substitui o LWW por timestamp bruto. Como eventos sao mutacoes granulares replayadas, **nao ha sobrescrita de entidade inteira** — elimina a perda silenciosa de campo do modelo de snapshot.

### 3. Transporte de eventos — REST mesh (ADR-063)

- HTTP Sync Server em Rust (axum + rustls), bind `0.0.0.0:8421` (ou interface LAN), `Authorization: Bearer <org_token>`.
- Descoberta mDNS (`mdns-sd`), filtro por `org_id`, fallback manual por IP/porta **no MVP**.
- Endpoints operam sobre o **log de eventos** (push de eventos novos, pull de eventos posteriores a um seq/HLC), nao sobre snapshots de entidade.
- TLS com fingerprint pinning por peer (ver camada de confianca).

### 4. Catch-up incremental (ancora)

- Snapshot gerado pelo ancora via `VACUUM INTO` (copia limpa do event store / projecoes).
- Protocolo: `catch_up = snapshot_completo + eventos_posteriores_ao_snapshot`. Nunca dump integral repetido.
- Insercao em **lotes transacionais** (ex.: 500 eventos/transacao) com checkpoint por lote. Interrupcao retoma do ultimo checkpoint. Protege mobile contra transacao gigante, bloqueio de I/O e perda total de progresso.

### 5. Transporte de blobs — content-addressed multi-source HTTP

- Blob ID = SHA-256 do conteudo (content-addressed; imutavel por definicao).
- Um evento referencia blobs por hash; o blob em si nao trafega no log de eventos.
- Indice de disponibilidade: cada peer publica quais hashes possui (entrada leve, sincronizada como evento ou via `GET /blobs/have`).
- Fetch por *range* HTTP de qualquer holder; suporta multiplos holders em paralelo (distribuicao tipo-swarm) sem DHT/tracker.
- GC de blobs orfaos (sem evento referenciando) por politica documentada.

### 6. Camada de confianca (admin peer)

- Sem "Admin Central". Papel = **admin peer** / autoridade administrativa do topico, exercido pelo ancora do departamento ou peer designado.
- Rotacao de chave via Key Wrapping **assinada pelo admin peer**; demais nos verificam a assinatura antes de aceitar a nova chave.
- Fingerprint TLS armazenado **por `device_id`** com estado de confianca (`pending`/`trusted`/`revoked`) e bootstrap explicito (ver Riscos / itens herdados do REV-063).

### 7. Desativacao progressiva do legado

- Sync legado (Supabase + pasta de rede) continua como transporte **durante a transicao**, operando sobre eventos (nao mais sobre linhas de tabela).
- `sync_cloud_enabled=false` por padrao; codigo mantido para reativacao opcional.

---

## Descartado (reserva, nao alvo)

| Alternativa | Por que nao agora |
|---|---|
| **libp2p** como transporte de eventos | Resolve NAT/descoberta internet-scale/malha grande — problemas inexistentes em LAN isolada pequena. Custo puro (transporte WebRTC em Capacitor exige signaling; em air-gap volta a mDNS). |
| **IPFS / WebTorrent** para blobs | DHT/tracker exigem bootstrap sem internet e sao redundantes com o peer-set mDNS ja conhecido. Reserva para escalada. |
| **Snapshot LWW puro** (modelo do ADR-063) | Nao guarda historico → nao satisfaz o requisito (8) de auditoria. Perde campo em edicao concorrente. |
| **Modelo "I+" (snapshot + HLC + tombstone)** | Mais barato (sem rewrite), mas tambem nao reconstroi historico — descartado pelo requisito (8). |

**Gatilho de escalada documentado:** migrar blobs para swarm real (WebTorrent com tracker local ou libp2p bitswap) **somente** se metrica `peers x tamanho x concorrencia` quebrar o HTTP multi-source. Nao comprometer agora.

---

## Consequencias

### Positivas

- Atende todas as restricoes (1)-(7) **e** os requisitos (8)-(9).
- Auditoria/historico imutavel nativo (event log) — sem precisar de tabela de auditoria paralela.
- HLC + eventos granulares eliminam a perda silenciosa de campo do LWW por snapshot.
- Catch-up incremental (snapshot + delta) + lotes transacionais = bootstrap barato e seguro em mobile.
- Blobs distribuidos sem gargalo no ancora, com infraestrutura minima.
- Transporte simples e debugavel; sem dependencia pesada (libp2p/IPFS).

### Negativas / trade-offs

- **Fase 0 (event sourcing) e rewrite do write path** — todo handler de mutacao muda (evento primeiro, projecao depois). Risco e esforco altos; ver REV-ADR-064.
- **Crescimento do log de eventos** — auditoria exige reter todos os eventos; mobile nao pode guardar log ilimitado. Resolucao: ancora desktop = arquivo completo; mobile = projecoes + cauda recente.
- **Determinismo de projecoes** — handlers de replay precisam ser puros/deterministicos, senao projecoes divergem entre peers.
- **Camada de blobs content-addressed e nova** — precisa de desenho proprio (indice de disponibilidade, chunking, GC). Nao ha codigo reaproveitavel.
- **Bootstrap de confianca TLS ainda em aberto** (herdado do REV-063 B3).

---

## Fases de implementacao

| Fase | Escopo | Observacao |
|---|---|---|
| **F0** | Event store canonico: tabela `events` imutavel (`topic_id`, `author_seq`, `hlc_timestamp`, `signature`), projecoes materializadas, handlers gravam evento primeiro. Legado opera sobre eventos. | Fundacao; maior risco. |
| **F1** | HLC + assinatura de eventos + hash com `stableStringify`. | Correcao de conflito e integridade. |
| **F2** | REST mesh (ADR-063 F1-F5): server axum+rustls, mDNS + fallback manual, push/pull de eventos, catch-up incremental em lotes. | Transporte de eventos. |
| **F3** | Camada de confianca: fingerprint por device, estados, bootstrap, admin peer assinando rotacao de chave. | Seguranca. |
| **F4** | Blobs content-addressed multi-source HTTP + indice de disponibilidade + GC. | Anexos. |
| **F5** | Mobile (Capacitor): cliente REST + catch-up em lotes + cauda de eventos; sem responsabilidade de ancora. | Cliente leve. |
| **F6** | Desligamento progressivo do legado (Supabase/pasta) → fallback opcional. | Transicao. |

**Ordem original:** F0→F1→F2→F4 (MVP desktops com auditoria e blobs) | depois F3 | por ultimo F5/F6.

**Ordem revisada (2026-06-18):** O desacoplamento do transporte (`SyncEventIndexFactory`) permite que **F2 seja executada independente de F0/F1**. O pipeline existente (`EventEnvelope` v2, `TransportService`, `InboundService`, `HandlerRegistry`, `CryptoLayer`) ja funciona — so falta implementar `createLanSyncEventIndex()` e o server axum. A `fila_eventos_sync` pode ser retida permanentemente (remover `DELETE ... > 90 days`) como log de auditoria sem exigir o rewrite do write-path (F0).

**Ordem viavel:** F2 (transporte LAN) → F3 (seguranca basica) → reter `fila_eventos_sync` como log permanente → avaliar F0/F1 (event sourcing/HLC) **se** necessidade real de replay/reconstrucao surgir.

---

## Metricas de sucesso

- [ ] Mutacao em um desktop aparece em outro em < 5s (via evento).
- [ ] Mutacao aparece em mobile em < 10s.
- [ ] Peer offline por 1h reconcilia backlog por catch-up incremental, sem dump integral.
- [ ] Replay do log reconstroi projecao identica em dois peers (determinismo).
- [ ] Edicao concorrente da mesma entidade resolve por HLC sem perda de campo.
- [ ] Historico completo reconstrutivel a partir do event store (requisito 8).
- [ ] Blob grande servido por multiplos holders sem saturar o ancora (requisito 9).
- [ ] Evento forjado (assinatura invalida) e rejeitado.
- [ ] Token errado → 401; fingerprint errado → handshake fail.

---

---

## Status de implementação (2026-06-18)

> Triagem de ADRs. Mapeia o que existe no código vs. o que está descrito nas Fases abaixo.

| Fase | Estado | Evidência no código |
|---|---|---|
| **F2 (transporte)** | 🟡 **Parcialmente pronto** — desacoplado, falta a implementação LAN concreta | `SyncEventIndexPort` (interface em `ecoforms-core`) + `SyncEventIndexFactory` em `lazy-sync.ts` existem (2026-06-18). Implementação concreta atual = `createSupabaseSyncEventIndex`. **Artefato faltante:** `createLanSyncEventIndex()` + server axum+rustls. Pipeline existente (`EventEnvelope` v2, `TransportService`, `InboundService`, `HandlerRegistry`, `CryptoLayer`) já opera sobre a interface — não conhece o backend. |
| **F0 (event store canônico)** | 🔴 **Não iniciada** | Não existe tabela `events`. Existe `fila_eventos_sync` (fila de sync, não event store). Tabelas de domínio ainda são a verdade; eventos são espelho (outbox/inbox). |
| **F1 (HLC + assinatura)** | 🔴 **Não iniciada** | Não há HLC, `author_seq` nem `topic_id` em nenhum `package.json`/schema. Hash de snapshot ainda usa `JSON.stringify` não-estável em `LanDomainSyncService.ts:53`. |
| **F3 (camada de confiança)** | 🔴 **Não iniciada** | Sem fingerprint por `device_id`, sem estados `pending`/`trusted`/`revoked`, sem bootstrap de chave de assinatura. |
| **F4 (blobs multi-source)** | 🔴 **Não iniciada** | Sem código de blob content-addressed, índice de disponibilidade ou GC. |
| **F5 (mobile)** | 🔴 **Não iniciada** | Mobile segue como consumidor do Mecanismo A atual (RPCs `sync_event_index`), não como peer REST. |
| **F6 (desligamento do legado)** | 🔴 **Não iniciada** | Legado (Supabase + `sync_event_index`) permanece como transporte ativo. |

> **Atalho de baixo risco identificado:** `fila_eventos_sync` pode ser retida permanentemente (remover `DELETE ... > 90 days`) como log de auditoria interino, **sem** exigir o rewrite do write-path (F0). Esta é a abordagem recomendada pela "Ordem viável" abaixo, enquanto a necessidade real de replay/reconstrução (requisito 8) não se materializa.

---

## Bloqueadores de aceitação (B1-B5)

> Incorporados da revisão técnica `REV-ADR-064-event-sourcing-rest-mesh-sync.md` (2026-06-18).
> Estes 5 pontos **bloqueiam a promoção de Proposto → Aceito**. Devem ser resolvidos **neste próprio ADR** (nova seção/subseção anexando o contrato) antes do aceite.

### B1 — Retenção do log vs. capacidade do mobile / SPOF de auditoria

Auditoria imutável (requisito 8) exige reter **todos** os eventos para sempre. O ADR resolve por divisão de papeis (âncora = arquivo completo; mobile = projeções + cauda), mas não fecha o contrato:

- Até onde o mobile trunca a cauda sem perder capacidade de operar offline?
- O que acontece se o **único** âncora com o log completo falhar de forma permanente (disco morto)? A auditoria mora em um único ponto físico — isso é um **SPOF de auditoria**.
- Há replicação do log completo entre múltiplos desktops, ou o âncora é singular?

**Contrato a adicionar neste ADR:** política de truncamento do mobile; ≥2 desktops mantendo log completo (réplica de auditoria); backup/exportação do event store.

### B2 — Determinismo de projeções não garantido por construção

Replay só reconstrói projeção idêntica se os handlers forem **puros e determinísticos**. Risco real:

- handler que usa `Date.now()`, `Math.random()`, `uuidv7()` ou ordem de iteração não-estável produz projeção divergente entre peers;
- mudança de versão de handler altera a projeção derivada do mesmo log → dois peers em versões diferentes divergem.

**Contrato a adicionar neste ADR:** cláusula de pureza dos handlers (sem efeito não-determinístico no replay); versionamento de handler/projeção; teste que replaya o mesmo log em dois ambientes e exige projeção idêntica.

### B3 — Assinatura de evento amarra auditoria à identidade de dispositivo

O ADR exige assinatura por evento (correto — sem ela o token compartilhado permite forjar histórico). Mas isso reabre o gap herdado do `REV-ADR-063` (B2/B3): **de onde vem a chave de assinatura por device e como os outros confiam nela?**

- token compartilhado por org autentica a org, não o dispositivo;
- se a chave de assinatura não for por device com bootstrap de confiança, a assinatura não prova autoria — vira só checksum.

**Contrato a adicionar neste ADR:** chave de assinatura por `device_id`, distribuição/registro da chave pública no bootstrap (mesmo canal do fingerprint TLS), comportamento ao ver evento assinado por device desconhecido ou revogado.

### B4 — Camada de blobs content-addressed é nova e subespecificada

Não há código reaproveitável. Para não virar fonte de inconsistência, precisa de contrato:

- formato do índice de disponibilidade (quem tem qual hash) e como sincroniza;
- tamanho de chunk e protocolo de *range* multi-source;
- comportamento quando nenhum holder online tem o blob referenciado por um evento já aplicado (estado parcial válido?);
- GC de blob órfão sem corrida com evento que ainda vai referenciá-lo;
- limite de tamanho e verificação de hash na recepção.

**Contrato a adicionar neste ADR:** seção "Contrato de blobs" com índice, chunking, estado parcial e GC.

### B5 — Fase 0 é um rewrite do write path com período de escrita dupla

Inverter "tabela é a verdade" para "evento é a verdade" toca todo handler de mutação. Durante a transição, há risco de **escrita dupla divergente** (evento gravado mas projeção falha, ou vice-versa).

**Contrato a adicionar neste ADR:** estratégia de escrita atômica evento+projeção (mesma transação SQLite) ou reconstrução de projeção on-read; plano de rollback por domínio; ordem de migração domínio-a-domínio (não big-bang).

---

## Achados pré-implementação (#1-#5)

> Incorporados da revisão técnica `REV-ADR-064`. **Bloqueiam o início de codificação de F0/F2.**

| # | Achado | Ação exigida antes de codificar |
|---|---|---|
| **#1** | "F0 imediatamente" subestima o custo — F0 é a fase **mais arriscada**, não a mais simples. | Definir **critério de saída da F0**: todos os domínios gravando evento primeiro + projeção determinística testada. Não iniciar F2 antes deste critério. |
| **#2** | `topic_id` entra como coluna obrigatória sem definição de fronteira (departamento? entidade? org?). | Definir **granularidade de `topic_id`** explicitamente — afeta roteamento, partição de log e escopo do admin peer. |
| **#3** | `author_seq` só detecta lacuna se monótona e sem buraco por device. | Especificar que o **pull detecta gap por `author_seq`** e re-puxa o intervalo faltante; definir comportamento em reset de device. |
| **#4** | HLC depende de persistir o último timestamp lógico e tratar regressão do relógio físico (NTP, fuso, troca de bateria). | Documentar **persistência do contador lógico** e a **regra de regressão** (nunca emitir HLC menor que o último observado). |
| **#5** | "Migrar para swarm se `peers × tamanho × concorrência` quebrar o HTTP multi-source" é correto mas sem limiar — inacionável. | Definir **limiar numérico** (ex.: throughput por holder, ou N peers puxando blob > X MB simultaneamente). |

---

## Referencias

- `ADR-063-p2p-mesh-sync-lan.md` — transporte REST mesh (camada sob este ADR). `[ARQUIVO INEXISTENTE — ADR-063 nunca foi formalizado como arquivo; sua modelagem (REST mesh HTTP/TLS + mDNS + LWW por last_event_id) está absorvida em "Componentes §3" e "Contexto" deste ADR. Tratar como referência histórica.]`
- `REV-ADR-063-p2p-mesh-sync-lan.md` — bloqueadores B1-B4 e achados técnicos. `[ARQUIVO INEXISTENTE — referência histórica. Os bloqueadores relevantes (B2/B3 sobre chave de device) foram incorporados em B3 deste ADR.]`
- rascunho "ADR-001" — event sourcing + HLC (modelo de dados adotado aqui). `[ARQUIVO INEXISTENTE — rascunho absorvido. Transporte libp2p/IPFS do rascunho original foi descartado (ver seção "Descartado").]`
- `desktop/src/infrastructure/sync/LanDomainSyncService.ts` — modelo de snapshot atual (superado).
- `desktop/scripts/ensure-columns.ts` — `fila_eventos_sync` (fila atual, não event store).
- `ecoforms-core` (raiz) — `stableStringify`, `uuidv7`.
- `REV-ADR-064-event-sourcing-rest-mesh-sync.md` — revisão técnica cujos bloqueadores B1-B5 e achados #1-#5 foram incorporados acima.
