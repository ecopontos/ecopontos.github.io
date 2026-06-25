# ADR-071 ÔÇö Dashboard Widget CRUD UI


> **Renumerado** de ADR-059 para ADR-071 em 2026-06-18 (triagem de ADRs — série `desktop/docs/adr/` consolidada em `docs/adr/`).


**Status:** Decidido  
**Data:** 2026-06-09  
**Autor:** Marcelo Luiz  
**Branch:** gaps-90-92-93-fix  
**Contexto externo:** Lacuna ­ƒƒí "Views CRUD / Dashboard widget UI: muta├º├Áes de views e UI de widgets ainda sem interface conectada" ÔÇö US-05 ├® majoritariamente leitura hoje.

---

## Contexto

### O que existe hoje

US-05 (Renderizar views e widgets do m├│dulo) tem backend funcional:

| Componente | Status |
|---|---|
| `tbl_view_registry` | Ô£à Tabela com views por m├│dulo/perfil |
| `GetActiveViewsUseCase` | Ô£à Retorna views ativas |
| `GetViewsByModuleUseCase` | Ô£à Filtra por m├│dulo |
| `DashboardVisualResolver` | Ô£à Resolve widgets ÔåÆ queries SQL |
| `VisualQueryCache` | Ô£à Cache com TTL |

O que **falta** ├® a interface para o administrador **criar/editar/excluir** views e widgets. Hoje os registros em `tbl_view_registry` s├úo inseridos manualmente (SQL direto ou seed script).

### Problema

- Administrador n├úo pode configurar dashboards sem acesso ao banco
- Widgets de novos m├│dulos exigem INSERT manual
- Mudan├ºas em queries de widget exigem redeploy

---

## Decis├úo

### Abordagem: Admin Panel inline no m├│dulo

Cada m├│dulo publicado ganha uma se├º├úo "Views e Widgets" acess├¡vel apenas para `admin` e `gerente`. A interface ├® **parte da p├ígina do m├│dulo** (`/modulo/[slug]`), n├úo uma rota separada.

```
ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ
Ôöé  M├│dulo: Agendamentos                    [admin] Ôöé
Ôöé  ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ Ôöé
Ôöé  Ôöé ­ƒôè Dashboard                                Ôöé Ôöé
Ôöé  Ôöé ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ ÔöîÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÉ     Ôöé Ôöé
Ôöé  Ôöé Ôöé Bookings  Ôöé Ôöé Slots    Ôöé Ôöé Cancelam Ôöé     Ôöé Ôöé
Ôöé  Ôöé Ôöé por dia   Ôöé Ôöé ocupados Ôöé Ôöé -entos   Ôöé     Ôöé Ôöé
Ôöé  Ôöé Ôöé ­ƒôê 47     Ôöé Ôöé ­ƒƒó 32    Ôöé Ôöé ­ƒö┤ 5     Ôöé     Ôöé Ôöé
Ôöé  Ôöé ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ     Ôöé Ôöé
Ôöé  Ôöé                                             Ôöé Ôöé
Ôöé  Ôöé [+ Adicionar Widget]  [­ƒöº Gerenciar Views]  Ôöé Ôöé  ÔåÉ NOVO
Ôöé  ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ Ôöé
ÔööÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÿ
```

### Tipos de widget suportados (fase 1)

| Tipo | Descri├º├úo | Config |
|---|---|---|
| `metric_card` | Card com valor ├║nico (ex: "47 bookings hoje") | `query` SQL, `label`, `format` (number/currency/percent) |
| `line_chart` | Gr├ífico de linha temporal | `query` SQL, `x_field`, `y_field`, `time_range` |
| `bar_chart` | Gr├ífico de barras | `query` SQL, `category_field`, `value_field` |
| `pie_chart` | Gr├ífico de pizza | `query` SQL, `label_field`, `value_field` |
| `table` | Tabela de dados | `query` SQL, `columns[]`, `page_size` |
| `map` | Mapa Leaflet (se m├│dulo tem coordenadas) | `query` SQL, `lat_field`, `lng_field`, `popup_template` |

### Armazenamento

```sql
CREATE TABLE tbl_view_registry (
    id TEXT PRIMARY KEY,
    module_slug TEXT NOT NULL,
    perfil TEXT NOT NULL DEFAULT 'admin',
    title TEXT NOT NULL,
    widget_type TEXT NOT NULL CHECK (widget_type IN ('metric_card','line_chart','bar_chart','pie_chart','table','map')),
    query_sql TEXT NOT NULL,
    config JSON NOT NULL DEFAULT '{}',  -- { x_field, y_field, format, columns, ... }
    position_x INTEGER NOT NULL DEFAULT 0,
    position_y INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 1,
    height INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Fluxo de cria├º├úo de widget

```
Admin clica [+ Adicionar Widget]
  ÔåÆ Modal: seleciona tipo (metric_card, line_chart, ...)
  ÔåÆ Editor de query SQL (textarea com syntax highlight m├¡nimo)
  ÔåÆ Preview da query (executa com LIMIT 5 no SQLite local)
  ÔåÆ Config visual (label, formato, cores, posi├º├úo no grid)
  ÔåÆ Salvar ÔåÆ INSERT em tbl_view_registry
  ÔåÆ Dashboard recarrega com novo widget
```

### Seguran├ºa

- **RBAC:** Apenas `admin` e `gerente` veem os bot├Áes de gerenciamento
- **Sanitiza├º├úo SQL:** Queries s├úo executadas via `invoke('db_query')` com par├ómetros bind ÔÇö nunca com concatena├º├úo de string do input do admin
- **Valida├º├úo:** `DashboardVisualResolver` j├í valida que a query retorna colunas compat├¡veis com o `widget_type`. Widget inv├ílido mostra erro amig├ível no lugar do gr├ífico, sem quebrar o dashboard.

---

## O que N├âO faz parte deste ADR

- **Drag-and-drop de widgets** ÔÇö Posicionamento via campos `position_x`/`position_y` no form. Drag-and-drop ├® nice-to-have futuro.
- **Widgets custom (iframe/HTML)** ÔÇö Apenas os 6 tipos pr├®-definidos. Custom widgets exigiriam sandbox de renderiza├º├úo.
- **Compartilhamento de queries entre m├│dulos** ÔÇö Cada widget pertence a um m├│dulo. Queries duplicadas entre m├│dulos s├úo aceitas (simplicidade).
- **Agendamento de refresh** ÔÇö O `VisualQueryCache` j├í tem TTL configur├ível. Sem scheduler por widget por enquanto.

---

## Implementa├º├úo

| Fase | Arquivo | Mudan├ºa |
|---|---|---|
| 1 | `desktop/src/application/view/CreateViewUseCase.ts` | Novo ÔÇö valida widget_type + query + config |
| 2 | `desktop/src/application/view/UpdateViewUseCase.ts` | Novo ÔÇö edita widget existente |
| 3 | `desktop/src/application/view/DeleteViewUseCase.ts` | Novo ÔÇö soft-delete (active=0) |
| 4 | `desktop/src/interface/components/dashboard/WidgetEditor.tsx` | Modal de cria├º├úo/edi├º├úo |
| 5 | `desktop/src/interface/components/dashboard/WidgetGrid.tsx` | Exibe widgets + bot├Áes admin |
| 6 | `desktop/src/interface/components/dashboard/QueryPreview.tsx` | Executa preview da query no SQLite |
| 7 | `ensure-columns.ts` | Atualizar schema `tbl_view_registry` com novas colunas |

---

## Rastreabilidade

| User Story | Cobertura |
|---|---|
| US-05 (M├│dulos) ÔÇö Renderizar views e widgets | Widgets agora s├úo CRUD completos, n├úo s├│ leitura |
| ADR-051 (Commands Backend) | Use cases de view expostos como commands Tauri |
