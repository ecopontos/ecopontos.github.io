# Índice de ADRs

> Gerado em 2026-06-18 (normalização de ADRs). Localização única: `docs/adr/`.
> Convenção de nomes: `YYYY-MM-DD-ADR-NNN-TÓPICO.md`.
> Status padronizado: **Proposto** | **Decidido** | **Implementado** | **Implementado (parcial)** | **Superseded** | **Rejeitado**.

Total: 50 ADRs.

| Nº | Data | Status | Título | Arquivo |
|---|---|---|---|---|
| 014 | 2026-05-19 | : Implementado (parcial) (Fase A concluí | Adequação Arquitetural: Consolidação de Acesso a Dados e Paridade Mobi | `2026-05-19-ADR-014-adequacao-arquitetural.md` |
| 015 | 2026-05-20 | : Implementado (mecânica core; UI dinâmi | Motor de Agendamento Compartilhado: Unificação de Slots, Recorrência e | `2026-05-20-ADR-015-motor-agendamento-compartilhado.md` |
| 016 | 2026-05-19 | : Implementado | Extração da Máquina de Estados da UI: Workflow Definition para Ouvidor | `2026-05-19-ADR-016-extracao-workflow-ouvidoria.md` |
| 017 | 2026-05-20 | : Superseded (ADR-015 foi o caminho esco | Unificação do Motor de Agendamento e Tarefas em Unified Service Engine | `2026-05-20-ADR-017-unificacao-motor-servicos.md` |
| 018 | 2026-05-20 | : Implementado | Service Booking Engine: Agendamentos Dinâmicos via Kanban + FormBuilde | `2026-05-20-ADR-018-service-booking-engine.md` |
| 019 | 2026-05-20 | : Implementado | Desacoplamento Booking/Task via Entidade Agendamento + Handler de Pont | `2026-05-20-ADR-019-desacoplamento-booking-task.md` |
| 020 | 2026-05-21 | : Implementado | Granular Sync com ID Indexador + Pasta LAN Configurável | `2026-05-21-ADR-020-granular-sync-index.md` |
| 021 | 2026-05-21 | : Implementado | Conformidade LGPD: Arquitetura de Dados Pessoais | `2026-05-21-ADR-021-lgpd-conformidade.md` |
| 022 | 2026-05-21 | : Proposto | Substituição do DomainEventBus por Orquestração Direta | `2026-05-21-ADR-022-substituicao-eventbus-orquestracao-direta.md` |
| 023 | 2026-05-22 | : Decidido | Consolidação RBAC: Perfis de Usuário, Hierarquia, Permissões e Setores | `2026-05-22-ADR-023-consolidacao-rbac-usuarios-setores.md` |
| 024 | 2026-05-22 | : Implementado | Controle de Acesso Horizontal por Setor/Departamento | `2026-05-22-ADR-024-controle-acesso-horizontal-setor.md` |
| 026 | 2026-05-22 | : Proposto | Task como Saída Universal: Camada de Conversão Canônica | `2026-05-22-ADR-026-task-como-saida-universal.md` |
| 027 | 2026-05-22 | : Implementado (LanPullService multi-dom | LAN Sync: Ciclo Completo (Push Multi-Domínio + Pull + Ingest + Provisã | `2026-05-22-ADR-027-lan-sync-ciclo-completo.md` |
| 028 | 2026-05-22 | : Implementado (ADR-052 criou CapacitorS | Banco Único Desktop/Mobile: SQLite Nativo com Schema Unificado e Provi | `2026-05-22-ADR-028-banco-unificado-desktop-mobile.md` |
| 029 | 2026-05-22 | : Proposto | Conexão UI do Módulo Logística: Preenchimento dos Gaps de Interface | `2026-05-22-ADR-029-conexao-ui-logistica.md` |
| 031 | 2026-05-26 | Implementado | Fetch de Dados Persistentes via LAN | `2026-05-26-ADR-031-lan-persistent-data-fetch.md` |
| 032 | 2026-05-26 | Implementado | Estado Persistente no ecopontoCaixasForm | `2026-05-26-ADR-032-ecoponto-caixas-form-estado-persistente.md` |
| 033 | 2026-05-26 | Implementado | ecoponto_id no Perfil do Usuário e defaultValueFrom nos Formulários | `2026-05-26-ADR-033-ecoponto-id-usuario-defaultValueFrom.md` |
| 035 | 2026-05-27 | Implementado (simplificado pelo ADR-036) | Estrutura de Navegação do Módulo de Remoção | `2026-05-27-ADR-035-modulo-remocao-navegacao.md` |
| 036 | 2026-05-27 | Implementado | Kanban de Remoção — Cards Automáticos por Caixa de Ecoponto | `2026-05-27-ADR-036-kanban-remocao-caixas-ecoponto.md` |
| 037 | 2026-05-27 | Implementado | Controle de Acesso por Turno — Tabela `escalas` e Auditoria de Sessão | `2026-05-27-ADR-037-controle-acesso-turno-escala.md` |
| 038 | 2026-05-28 | Implementado (2026-06-09) | Geoprocessamento de Terrenos e Itinerários de Logística | `2026-05-28-ADR-038-geoprocessamento-terrenos-itinerarios.md` |
| 039 | 2026-05-28 | Implementado (2026-06-09) | Mapa de Logística — Execução, Intercorrências e Evidências Geo | `2026-05-28-ADR-039-mapa-execucao-intercorrencias-evidencias.md` |
| 040 | 2026-05-29 | Implementado (2026-06-09) | Gaps identificados no BookingModal — Correções e Decisões de Arquitetu | `2026-05-29-ADR-040-booking-modal-gaps.md` |
| 041 | 2026-05-29 | Implementado (2026-06-09) | Gaps identificados no módulo Manifestações (Ouvidoria) | `2026-05-29-ADR-041-manifestacoes-gaps.md` |
| 042 | 2026-05-29 | Implementado | Gaps identificados no módulo Agendamentos | `2026-05-29-ADR-042-agendamentos-gaps.md` |
| 043 | 2026-05-29 | Implementado (2026-06-09) | Gaps identificados no módulo Ecopontos | `2026-05-29-ADR-043-ecopontos-gaps.md` |
| 044 | 2026-05-29 | Implementado | Gaps identificados em `components/tasks/` | `2026-05-29-ADR-044-tasks-components-gaps.md` |
| 045 | 2026-05-29 | Implementado | Gaps identificados no módulo Clientes | `2026-05-29-ADR-045-clientes-gaps.md` |
| 046 | 2026-05-29 | Implementado | Gaps identificados no módulo Usuários | `2026-05-29-ADR-046-usuarios-gaps.md` |
| 047 | 2026-05-29 | Implementado (2026-06-09) | Gaps identificados no módulo Setores (Segregação de Conteúdo) | `2026-05-29-ADR-047-setores-gaps.md` |
| 048 | 2026-05-29 | Implementado (2026-06-09) | Gaps identificados no módulo FormBuilder | `2026-05-29-ADR-048-formbuilder-gaps.md` |
| 049 | 2026-05-29 | Implementado | Módulos: Gaps de Implementação | `2026-05-29-ADR-049-modulos-gaps.md` |
| 050 | 2026-05-29 | Implementado | Gaps — Data Registry | `2026-05-29-ADR-050-data-registry-gaps.md` |
| 051 | 2026-06-02 | Implementado (key_rotation → opção A + U | Commands de backend implementados mas não expostos ao frontend | `2026-06-02-ADR-051-commands-backend-nao-expostos.md` |
| 055 | 2026-06-03 | Implementado | Revisão de Gaps UI por Módulo | `2026-06-03-ADR-055-revisao-gaps-ui-modulos.md` |
| 056 | 2026-06-11 | Decidido (implementação majoritariamente | Fonte de Verdade dos Dados | `2026-06-11-ADR-056-fonte-de-verdade.md` |
| 057 | 2026-06-17 | Implementado (parcial) (inventário) | Higiene da estrutura do repositorio e separacao de artefatos | `2026-06-17-ADR-057-higiene-estrutura-repositorio.md` |
| 064 | 2026-06-18 | Decidido (revisão técnica pendente — ver | Arquitetura de Sincronizacao Consolidada (Event Sourcing + REST Mesh L | `2026-06-18-ADR-064-event-sourcing-rest-mesh-sync.md` |
| 065 | 2026-06-03 | Implementado (Fases 1ÔÇô4) | ADR-065 ÔÇö Unifica├º├úo do storage mobile: IndexedDB ÔåÆ SQLite | `2026-06-03-ADR-065-mobile-sqlite-unification.md` |
| 066 | 2026-06-03 | Implementado | ADR-066 ÔÇö Flag `requerMapa` no ServiceType para exibi├º├úo de roteir | `2026-06-03-ADR-066-service-type-requer-mapa.md` |
| 067 | 2026-06-03 | Implementado | ADR-067 ÔÇö Corre├º├Áes de Gaps no Geoprocessamento (ADR-038) | `2026-06-03-ADR-067-correcoes-gaps-geoprocessamento.md` |
| 068 | 2026-06-09 | Decidido | ADR-068 ÔÇö Pipeline de Sincroniza├º├úo do Mobile | `2026-06-09-ADR-068-mobile-sync-pipeline.md` |
| 069 | 2026-06-09 | Decidido | ADR-069 ÔÇö Email real no cadastro de usu├írios | `2026-06-09-ADR-069-email-real-usuarios.md` |
| 070 | 2026-06-09 | Decidido | ADR-070 ÔÇö Confirma├º├úo da Orquestra├º├úo Direta p├│s-ADR-022 | `2026-06-09-ADR-070-orquestracao-direta-pos-adr-022.md` |
| 071 | 2026-06-09 | Decidido | ADR-071 ÔÇö Dashboard Widget CRUD UI | `2026-06-09-ADR-071-dashboard-widget-crud-ui.md` |
| 072 | 2026-06-09 | Proposto | ADR-072 ÔÇö Auto-Updater do Tauri Desktop | `2026-06-09-ADR-072-auto-updater-tauri.md` |
| 073 | 2026-06-12 | Implementado (parcial) (Fase 1 conclu├¡d | Performance de Renderiza├º├úo Geoespacial | `2026-06-12-ADR-073-performance-geospatial-rendering.md` |
| 074 | 2026-06-11 | Proposto | ADR-074 ÔÇö First-Run Setup com Descoberta de Caminho LAN | `2026-06-11-ADR-074-first-run-lan-setup.md` |
| REV-064 | 2026-06-18 | ? | Revisao tecnica — ADR-064 Sincronizacao Consolidada | `2026-06-18-REV-ADR-064-event-sourcing-rest-mesh-sync.md` |

## Regras

1. **Numeração sequencial**: ADR-014 a ADR-074. Próximo número livre: **075**.
2. **Renumerados (2026-06-18)**: ADRs 052-061 + 040 (perf-geospatial) da série `desktop/docs/adr/` foram renumerados para 065-074 ao serem consolidados. Cada um tem nota de renumeração no corpo.
3. **Sem colisões**: os pares ADR-056 (fonte-verdade) / ADR-056-mobile-sync e ADR-057 (higiene) / ADR-057-email-real foram resolvidos — mobile-sync virou ADR-068, email-real virou ADR-069.
4. **REV-ADR-NNN**: revisões técnicas de ADRs (não são ADRs próprios, são pareceres sobre um ADR existente).
5. **Status field**: cada ADR tem um único campo `Status:` no frontmatter seguindo o enum padronizado.
6. **Não-ADRs em docs/**: planos, auditorias, inventários e registros ficam em `docs/` raiz ou `docs/Concluidos/`, não em `docs/adr/`.

## Renumerados (rastreabilidade)

Estes ADRs mudaram de número ao serem consolidados da série `desktop/docs/adr/` em 2026-06-18:

| Antigo | Novo | Tópico |
|---|---|---|
| ADR-052 | ADR-065 | mobile-sqlite-unification |
| ADR-053 | ADR-066 | service-type-requer-mapa |
| ADR-054 | ADR-067 | correcoes-gaps-geoprocessamento |
| ADR-056 | ADR-068 | mobile-sync-pipeline (homonimo do 056-fonte-verdade) |
| ADR-057 | ADR-069 | email-real-usuarios (homonimo do 057-higiene) |
| ADR-058 | ADR-070 | orquestracao-direta-pos-adr-022 |
| ADR-059 | ADR-071 | dashboard-widget-crud-ui |
| ADR-060 | ADR-072 | auto-updater-tauri |
| ADR-040 | ADR-073 | performance-geospatial-rendering (homonimo do 040-booking-modal-gaps) |
| ADR-061 | ADR-074 | first-run-lan-setup |
