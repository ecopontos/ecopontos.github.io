import { Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ManifestacaoSummary } from "@/src/domain/ouvidoria/ManifestacaoRepository";
import { STATUS_LABEL, statusVariant, urgencyScore, relativeTime, UrgencyDot } from "../_lib/helpers";

interface ActivityFeedProps {
  feed: ManifestacaoSummary[];
  onOpenModal: (m: ManifestacaoSummary) => void;
}

/** Coluna lateral "Atividade recente": últimas manifestações atualizadas. */
export function ActivityFeed({ feed, onOpenModal }: ActivityFeedProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 h-7">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Atividade recente</h2>
      </div>
      <Card>
        <CardContent className="p-0 divide-y max-h-[calc(100vh-320px)] overflow-y-auto">
          {feed.length === 0 ? (
            <p className="text-muted-foreground text-sm p-4">Sem atividade registrada.</p>
          ) : feed.map(m => {
            const score = urgencyScore(m);
            return (
              <div key={m.id} className="px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => onOpenModal(m)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <UrgencyDot score={score} />
                    <p className="font-mono text-xs font-semibold truncate">{m.protocolo}</p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{relativeTime(m.atualizadoEm!)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5 pl-3.5">{m.assunto}</p>
                <div className="flex items-center gap-1.5 mt-1 pl-3.5">
                  <Badge variant={statusVariant(m.status)} className="text-xs py-0 h-4 leading-none">
                    {STATUS_LABEL[m.status] ?? m.status}
                  </Badge>
                  {m.responsavelNome && <span className="text-xs text-muted-foreground truncate">→ {m.responsavelNome}</span>}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
