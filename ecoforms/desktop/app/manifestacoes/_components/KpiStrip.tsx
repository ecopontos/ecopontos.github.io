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

/** Faixa de KPIs do painel de manifestações (vencidas, vence em 48h, aguardando, novas hoje). */
export function KpiStrip({ kpis, onSelectFilter }: KpiStripProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { label: "Vencidas",      value: kpis.vencidas,    icon: AlertTriangle, color: "red",    filter: 'todos' as QuickFilter,    sub: "prazo expirado" },
        { label: "Vence em 48h",  value: kpis.vencendo48h, icon: Clock,         color: "orange", filter: 'vencendo' as QuickFilter, sub: "requerem ação" },
        { label: "Aguardando",    value: kpis.aguardando,  icon: Inbox,         color: "blue",   filter: 'todos' as QuickFilter,    sub: "em aberto" },
        { label: "Novas hoje",    value: kpis.novasHoje,   icon: CheckCircle2,  color: "green",  filter: 'novas' as QuickFilter,    sub: "registradas hoje" },
      ].map(({ label, value, icon: Icon, color, filter, sub }) => (
        <Card
          key={label}
          className={`cursor-pointer border-l-4 border-l-${color}-${color === 'blue' ? '400' : color === 'green' ? '400' : color === 'orange' ? '400' : '500'} hover:bg-${color}-50/40 transition-colors`}
          onClick={() => onSelectFilter(filter)}
        >
          <CardHeader className="pb-1 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`h-4 w-4 text-${color}-${color === 'red' ? '500' : '400'}`} />
            </div>
          </CardHeader>
          <CardContent className="pb-4 px-4">
            <p className={`text-3xl font-bold text-${color}-${color === 'red' ? '600' : color === 'orange' ? '500' : '600'}`}>{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
