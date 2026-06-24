# ADR-059 — Dashboard Widget CRUD UI

**Status:** Decidido  
**Data:** 2026-06-09  
**Autor:** Marcelo Luiz  
**Branch:** gaps-90-92-93-fix  
**Contexto externo:** Lacuna 🟡 "Views CRUD / Dashboard widget UI: mutações de views e UI de widgets ainda sem interface conectada" — US-05 é majoritariamente leitura hoje.

---

## Contexto

### O que existe hoje

US-05 (Renderizar views e widgets do módulo) tem backend funcional:

| Componente | Status |
|---|---|
| `tbl_view_registry` | ✅ Tabela com views por módulo/perfil |
| `GetActiveViewsUseCase` | ✅ Retorna views ativas |
| `GetViewsByModuleUseCase` | ✅ Filtra por módulo |
| `DashboardVisualResolver` | ✅ Resolve widgets → queries SQL |
| `VisualQueryCache` | ✅ Cache com TTL |

O que **falta** é a interface para o administrador **criar/editar/excluir** views e widgets. Hoje os registros em `tbl_view_registry` são inseridos manualmente (SQL direto ou seed script).

### Problema

- Administrador não pode configurar dashboards sem acesso ao banco
- Widgets de novos módulos exigem INSERT manual
- Mudanças em queries de widget exigem redeploy

---

## Decisão

### Abordagem: Admin Panel inline no módulo

Cada módulo publicado ganha uma seção "Views e Widgets" acessível apenas para `admin` e `gerente`. A interface é **parte da página do módulo** (`/modulo/[slug]`), não uma rota separada.

```
┌─────────────────────────────────────────────────┐
│  Módulo: Agendamentos                    [admin] │
│  ┌─────────────────────────────────────────────┐ │
│  │ 📊 Dashboard                                │ │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐     │ │
│  │ │ Bookings  │ │ Slots    │ │ Cancelam │     │ │
│  │ │ por dia   │ │ ocupados │ │ -entos   │     │ │
│  │ │ 📈 47     │ │ 🟢 32    │ │ 🔴 5     │     │ │
│  │ └──────────┘ └──────────┘ └──────────┘     │ │
│  │                                             │ │
│  │ [+ Adicionar Widget]  [🔧 Gerenciar Views]  │ │  ← NOVO
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Tipos de widget suportados (fase 1)

| Tipo | Descrição | Config |
|---|---|---|
| `metric_card` | Card com valor único (ex: "47 bookings hoje") | `query` SQL, `label`, `format` (number/currency/percent) |
| `line_chart` | Gráfico de linha temporal | `query` SQL, `x_field`, `y_field`, `time_range` |
| `bar_chart` | Gráfico de barras | `query` SQL, `category_field`, `value_field` |
| `pie_chart` | Gráfico de pizza | `query` SQL, `label_field`, `value_field` |
| `table` | Tabela de dados | `query` SQL, `columns[]`, `page_size` |
| `map` | Mapa Leaflet (se módulo tem coordenadas) | `query` SQL, `lat_field`, `lng_field`, `popup_template` |

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

### Fluxo de criação de widget

```
Admin clica [+ Adicionar Widget]
  → Modal: seleciona tipo (metric_card, line_chart, ...)
  → Editor de query SQL (textarea com syntax highlight mínimo)
  → Preview da query (executa com LIMIT 5 no SQLite local)
  → Config visual (label, formato, cores, posição no grid)
  → Salvar → INSERT em tbl_view_registry
  → Dashboard recarrega com novo widget
```

### Segurança

- **RBAC:** Apenas `admin` e `gerente` veem os botões de gerenciamento
- **Sanitização SQL:** Queries são executadas via `invoke('db_query')` com parâmetros bind — nunca com concatenação de string do input do admin
- **Validação:** `DashboardVisualResolver` já valida que a query retorna colunas compatíveis com o `widget_type`. Widget inválido mostra erro amigável no lugar do gráfico, sem quebrar o dashboard.

---

## O que NÃO faz parte deste ADR

- **Drag-and-drop de widgets** — Posicionamento via campos `position_x`/`position_y` no form. Drag-and-drop é nice-to-have futuro.
- **Widgets custom (iframe/HTML)** — Apenas os 6 tipos pré-definidos. Custom widgets exigiriam sandbox de renderização.
- **Compartilhamento de queries entre módulos** — Cada widget pertence a um módulo. Queries duplicadas entre módulos são aceitas (simplicidade).
- **Agendamento de refresh** — O `VisualQueryCache` já tem TTL configurável. Sem scheduler por widget por enquanto.

---

## Implementação

| Fase | Arquivo | Mudança |
|---|---|---|
| 1 | `desktop/src/application/view/CreateViewUseCase.ts` | Novo — valida widget_type + query + config |
| 2 | `desktop/src/application/view/UpdateViewUseCase.ts` | Novo — edita widget existente |
| 3 | `desktop/src/application/view/DeleteViewUseCase.ts` | Novo — soft-delete (active=0) |
| 4 | `desktop/src/interface/components/dashboard/WidgetEditor.tsx` | Modal de criação/edição |
| 5 | `desktop/src/interface/components/dashboard/WidgetGrid.tsx` | Exibe widgets + botões admin |
| 6 | `desktop/src/interface/components/dashboard/QueryPreview.tsx` | Executa preview da query no SQLite |
| 7 | `ensure-columns.ts` | Atualizar schema `tbl_view_registry` com novas colunas |

---

## Rastreabilidade

| User Story | Cobertura |
|---|---|
| US-05 (Módulos) — Renderizar views e widgets | Widgets agora são CRUD completos, não só leitura |
| ADR-051 (Commands Backend) | Use cases de view expostos como commands Tauri |
