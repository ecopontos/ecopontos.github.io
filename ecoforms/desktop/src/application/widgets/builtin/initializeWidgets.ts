import { registerWidget } from "@/src/application/widgets/WidgetRegistry";

export function registerBuiltinWidgets() {
  // KPI: Tarefas abertas atribuídas ao usuário
  registerWidget({
    id: "tarefas_abertas",
    type: "kpi_card",
    title: "Tarefas Abertas",
    dataSource: { useCaseGroup: "tasks", method: "listByProject", params: {} },
    requiredRoles: ["admin", "gerente", "coordenador", "operador"],
    options: { valuePath: "length", subtitlePath: undefined },
  });

  // Bar chart: Tarefas por status (simulado via listByProject + agregação client-side)
  registerWidget({
    id: "tarefas_por_status",
    type: "bar_chart",
    title: "Tarefas por Status",
    dataSource: { useCaseGroup: "tasks", method: "listByProject", params: {} },
    requiredRoles: ["admin", "gerente", "coordenador"],
    options: { labelKey: "status", valueKey: "count" },
  });

  // Recent activity: placeholder — a ser populado por query custom no page.tsx
  registerWidget({
    id: "atividade_recente",
    type: "recent_activity",
    title: "Atividade Recente",
    dataSource: { useCaseGroup: "tasks", method: "listByProject", params: { limit: 5 } },
    requiredRoles: ["admin", "gerente", "coordenador", "operador"],
  });


}
