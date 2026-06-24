# Registro de Referências Históricas

- **Data:** 2026-06-18 (atualizado pós-normalização)
- **Origem:** triagem de ADRs
- **Estado:** normalização concluída — ver `docs/adr/INDEX.md` para o mapa canônico.

> Este registro documenta referências a ADRs que **nunca existiram como arquivo formal** (são menções históricas absorvidas em outros ADRs). Para o mapa completo de ADRs existentes, consulte `docs/adr/INDEX.md`.

---

## 1. ADRs referenciados mas sem arquivo (referências históricas)

| Referência | Onde é citada | Situação real | Ação |
|---|---|---|---|
| **ADR-001** (rascunho) | `ADR-064` (Contexto, Decisão) | Rascunho informal (event sourcing + libp2p/IPFS). Modelo absorvido pelo ADR-064; transporte libp2p/IPFS descartado. | Não criar arquivo. |
| **ADR-063** | `ADR-064` (Contexto, Referências) | P2P Mesh LAN. **Nunca formalizado.** Modelagem absorvida pelo ADR-064 como camada de transporte. | Não criar arquivo. ADR-064 já anota `[ARQUIVO INEXISTENTE]` inline. |
| **REV-ADR-063** | `ADR-064` (Referências) | Revisão técnica do ADR-063. Bloqueadores B2/B3 incorporados ao ADR-064 (B3). | Não criar arquivo. |

---

## 2. Colisões de numeração — RESOLVIDAS (2026-06-18)

As colisões ADR-056 e ADR-057 foram resolvidas por renumeração da série `desktop/docs/adr/`:

| Original (colidente) | Renumerado para | Tópico | Arquivo atual |
|---|---|---|---|
| ADR-056 (mobile-sync-pipeline) | **ADR-068** | Pipeline de Sync do Mobile | `docs/adr/2026-06-09-ADR-068-mobile-sync-pipeline.md` |
| ADR-057 (email-real-usuarios) | **ADR-069** | Email real no cadastro | `docs/adr/2026-06-09-ADR-069-email-real-usuarios.md` |
| ADR-040 (perf-geospatial-rendering) | **ADR-073** | Perf. Geoespacial | `docs/adr/2026-06-12-ADR-073-performance-geospatial-rendering.md` |

Os **donos legítimos** dos números permanecem:
- **ADR-056** = Fonte de Verdade dos Dados (`docs/adr/2026-06-11-ADR-056-fonte-de-verdade.md`)
- **ADR-057** = Higiene Estrutural do Repositório (`docs/adr/2026-06-17-ADR-057-higiene-estrutura-repositorio.md`)
- **ADR-040** = Gaps do BookingModal (`docs/adr/2026-05-29-ADR-040-booking-modal-gaps.md`)

> **Não há mais ambiguidade:** "ADR-056" refere-se sempre à Fonte de Verdade; "ADR-057" sempre à Higiene; "ADR-040" sempre ao BookingModal.

---

## 3. Referências cruzadas atualizadas

| Arquivo | Linha | Original | Atualizado para |
|---|---|---|---|
| `docs/2026-06-07-CHECKLIST-ENCERRAMENTO-DESKTOP.md` | 88 | `ADR-060` (auto-updater) | `ADR-073` (renumerado) |

---

## 4. Rastreabilidade da normalização

Para o histórico completo de renumeração (052→065, 053→066, ..., 061→074), consulte a seção "Renumerados (rastreabilidade)" em `docs/adr/INDEX.md`.
