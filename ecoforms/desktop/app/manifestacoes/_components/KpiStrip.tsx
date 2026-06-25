import { AlertTriangle, Clock, Inbox, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuickFilter } from "../_lib/helpers";

interface KpiStripProps {
  kpis: {
    vencidas: number;
    vencendo48h: number;
    aguardando: number;
    novasHoje: number;
  };
  onSelectFilter: (filter: QuickFilter) => void;
}

const KPI_ITEMS = [
  {
    label: "Vencidas",
    key: "vencidas" as const,
    icon: AlertTriangle,
    filter: "todos" as QuickFilter,
    sub: "prazo expirado",
    cardClass: "border-l-red-500 hover:bg-red-50/40",
    iconClass: "text-red-500",
    valueClass: "text-red-600",
  },
  {
    label: "Vence em 48h",
    key: "vencendo48h" as const,
    icon: Clock,
    filter: "vencendo" as QuickFilter,
    sub: "requerem ação",
    cardClass: "border-l-orange-400 hover:bg-orange-50/40",
    iconClass: "text-orange-400",
    valueClass: "text-orange-500",
  },
  {
    label: "Aguardando",
    key: "aguardando" as const,
    icon: Inbox,
    filter: "todos" as QuickFilter,
    sub: "em aberto",
    cardClass: "border-l-blue-400 hover:bg-blue-50/40",
    iconClass: "text-blue-400",
    valueClass: "text-blue-600",
  },
  {
    label: "Novas hoje",
    key: "novasHoje" as const,
    icon: CheckCircle2,
    filter: "novas" as QuickFilter,
    sub: "registradas hoje",
    cardClass: "border-l-green-400 hover:bg-green-50/40",
    iconClass: "text-green-400",
    valueClass: "text-green-600",
  },
] as const;

/** Faixa de KPIs do painel de manifestações (vencidas, vence em 48h, aguardando, novas hoje). */
export function KpiStrip({ kpis, onSelectFilter }: KpiStripProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {KPI_ITEMS.map(({ label, key, icon: Icon, filter, sub, cardClass, iconClass, valueClass }) => (
        <Card
          key={label}
          className={`cursor-pointer border-l-4 transition-colors ${cardClass}`}
          onClick={() => onSelectFilter(filter)}
        >
          <CardHeader className="pb-1 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 ${iconClass}`} />
            </div>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className={`text-3xl font-bold ${valueClass}`}>{kpis[key]}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
