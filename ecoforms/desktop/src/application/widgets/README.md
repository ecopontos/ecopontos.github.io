# Widgets — ADR-010 vs ADR-011

Este diretório contém dois sistemas de widgets com contratos diferentes:

## module_visual_views (ADR-010 — Module Visual Builder)

**Quem usa:** Admin (Module Builder)
**Contrato:** SQL puro com bind params + prepared statements
**Persistência:** `module_visual_views` table
**Tipos:** table, chart, kanban, timeline, summary
**Quando usar:** Admin precisa de consultas complexas (agregações SQL, bind params dinâmicos, SQLite views indexadas)

## user_widget_instances (ADR-011 — Self-Service Analytics)

**Quem usa:** Usuário final (Dashboard Composer)
**Contrato:** Use-case reflection via `container.<grupo>.<metodo>.execute(params)`
**Persistência:** `user_widget_instances` table
**Tipos:** kpi_card, bar_chart, pie_chart, line_chart, area_chart, table, recent_activity
**Quando usar:** Usuário final arrasta widgets para dashboard pessoal

## Interoperabilidade

- Um `user_widget_instances` pode referenciar um `module_visual_views` via `data_source.visual_id`
- Ambos alimentam `view_registry.widgets[]` como camada de composição (dashboards)
- O `VisualRenderer` (ADR-010) renderiza dados de `module_visual_views`
- O `DashboardComposer` (ADR-011, Fase 2) renderiza dados de `user_widget_instances`

## Regra de decisão

```
Precisa de SQL complexo (JOIN, subquery, window function)?
  → module_visual_views (ADR-010)
  
Usuário quer arrastar campos e ver resultados imediatos?
  → user_widget_instances (ADR-011)
  
Ambos?
  → Criar visual na ADR-010, referenciar na ADR-011 via visual_id
```
