# Widgets — ADR-010 vs ADR-011

Este diretório contém dois sistemas de widgets com contratos diferentes:

## visuais_modulos (ADR-010 — Module Visual Builder)

**Quem usa:** Admin (Module Builder)
**Contrato:** SQL puro com bind params + prepared statements
**Persistência:** `visuais_modulos` table
**Tipos:** table, chart, kanban, timeline, summary
**Quando usar:** Admin precisa de consultas complexas (agregações SQL, bind params dinâmicos, SQLite views indexadas)

## instancias_widgets_usuario (ADR-011 — Self-Service Analytics)

**Quem usa:** Usuário final (Dashboard Composer)
**Contrato:** Use-case reflection via `container.<grupo>.<metodo>.execute(params)`
**Persistência:** `instancias_widgets_usuario` table
**Tipos:** kpi_card, bar_chart, pie_chart, line_chart, area_chart, table, recent_activity
**Quando usar:** Usuário final arrasta widgets para dashboard pessoal

## Interoperabilidade

- Um `instancias_widgets_usuario` pode referenciar um `visuais_modulos` via `data_source.visual_id`
- Ambos alimentam `registro_visualizacoes.widgets[]` como camada de composição (dashboards)
- O `VisualRenderer` (ADR-010) renderiza dados de `visuais_modulos`
- O `DashboardComposer` (ADR-011, Fase 2) renderiza dados de `instancias_widgets_usuario`

## Regra de decisão

```
Precisa de SQL complexo (JOIN, subquery, window function)?
  → visuais_modulos (ADR-010)
  
Usuário quer arrastar campos e ver resultados imediatos?
  → instancias_widgets_usuario (ADR-011)
  
Ambos?
  → Criar visual na ADR-010, referenciar na ADR-011 via visual_id
```
