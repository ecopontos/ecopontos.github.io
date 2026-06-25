import { Badge } from "@/components/ui/badge";
import type { ManifestacaoSummary } from "@/src/domain/ouvidoria/ManifestacaoRepository";
import { isManifestacaoTerminal } from "@/src/domain/ouvidoria/ManifestacaoWorkflowPolicy";
import { MANIFESTACAO_PRESENTATION } from "@/src/interface/workflow/ManifestacaoWorkflowPresentation";
import type { ManifestacaoStatus } from "@/src/domain/ouvidoria/ManifestacaoStateMachine";

// ── Constants ──────────────────────────────────────────────────────────────────

export const STATUS_LABEL: Record<string, string> = {
  aberta: "Aberta", em_analise: "Em análise", em_atendimento: "Em atendimento",
  respondida: "Respondida", em_avaliacao: "Em avaliação", devolvida: "Devolvida",
  encaminhado_sema: "Enc. SEMA", encerrada: "Encerrada", cancelada: "Cancelada",
};

export function statusVariant(status: string) {
  return MANIFESTACAO_PRESENTATION[status as ManifestacaoStatus]?.badgeVariant ?? 'outline';
}

export type QuickFilter = 'todos' | 'minha_fila' | 'aguardando_aceite' | 'devolvidas' | 'vencendo' | 'novas';

// ── Pure helpers ───────────────────────────────────────────────────────────────

export function urgencyScore(m: ManifestacaoSummary): number {
  if (isManifestacaoTerminal(m.status)) return 4;
  const now = new Date();
  const prazo = m.prazoLimite ? new Date(m.prazoLimite) : null;
  if (prazo && prazo < now) return 0;
  if ((prazo && prazo.getTime() - now.getTime() <= 48 * 3_600_000) || m.prioridade === 'critico') return 1;
  if (m.prioridade === 'urgente') return 2;
  return 3;
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d atrás` : new Date(iso).toLocaleDateString("pt-BR");
}

export function rowBorder(score: number): string {
  switch (score) {
    case 0: return "border-l-[3px] border-l-red-500 bg-red-50/50";
    case 1: return "border-l-[3px] border-l-orange-400 bg-orange-50/30";
    case 2: return "border-l-[3px] border-l-yellow-400";
    default: return "";
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

export function UrgencyDot({ score }: { score: number }) {
  const cls =
    score === 0 ? "bg-red-500" :
    score === 1 ? "bg-orange-400" :
    score === 2 ? "bg-yellow-400" : "bg-muted-foreground/20";
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${cls}`} />;
}

export function PrazoBadge({ m }: { m: ManifestacaoSummary }) {
  if (!m.prazoLimite) return <span className="text-muted-foreground text-xs">—</span>;
  const prazo = new Date(m.prazoLimite);
  const now = new Date();
  if (isManifestacaoTerminal(m.status))
    return <span className="text-xs text-muted-foreground">{prazo.toLocaleDateString("pt-BR")}</span>;
  const diffMs = prazo.getTime() - now.getTime();
  const diffH = Math.floor(diffMs / 3_600_000);
  const diffD = Math.floor(diffMs / 86_400_000);
  if (diffMs < 0)
    return <Badge variant="destructive" className="text-xs py-0">há {Math.abs(diffD) || "<1"}d</Badge>;
  if (diffH < 24)
    return <Badge className="text-xs py-0 bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-100">em {diffH}h</Badge>;
  if (diffD <= 3)
    return <Badge variant="outline" className="text-xs py-0 text-orange-600 border-orange-300">em {diffD}d</Badge>;
  return <span className="text-xs text-muted-foreground">{prazo.toLocaleDateString("pt-BR")}</span>;
}
