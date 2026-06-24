import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ManifestacaoSummary, Resposta } from "@/src/domain/ouvidoria/ManifestacaoRepository";
import { isManifestacaoTerminal } from "@/src/domain/ouvidoria/ManifestacaoWorkflowPolicy";

interface RespostasTabProps {
  selected: ManifestacaoSummary;
  respostas: Resposta[];
  respTexto: string;
  onRespTextoChange: (value: string) => void;
  onAddResposta: () => void;
  saving: boolean;
}

/** Aba "Respostas": registro de resposta técnica interna + histórico. */
export function RespostasTab({
  selected, respostas, respTexto, onRespTextoChange, onAddResposta, saving,
}: RespostasTabProps) {
  return (
    <>
      {!isManifestacaoTerminal(selected.status) && (
        <div className="rounded-md border p-4 space-y-3 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nova resposta técnica</p>
          <div className="flex gap-2 items-end">
            <Textarea
              value={respTexto}
              onChange={e => onRespTextoChange(e.target.value)}
              placeholder="Texto da resposta técnica interna..."
              rows={3}
              className="flex-1 text-sm"
            />
            <Button size="sm" onClick={onAddResposta} disabled={saving || !respTexto.trim()} className="self-end">
              Registrar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Para formatar e enviar ao cidadão, use a página de detalhes.</p>
        </div>
      )}

      {respostas.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma resposta registrada.</p>
      ) : (
        <div className="space-y-2">
          {respostas.map(r => (
            <div key={r.id} className="rounded-md border p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {r.respostaFormatada
                    ? <Badge variant="outline" className="text-xs text-green-700 border-green-400">Formatada</Badge>
                    : <Badge variant="secondary" className="text-xs">Rascunho</Badge>}
                  {r.revisadaPor && <span className="text-xs text-muted-foreground">revisada por {r.revisadaPor}</span>}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{new Date(r.enviadaEm).toLocaleString("pt-BR")}</span>
              </div>
              <p className="text-sm text-foreground/80 line-clamp-3">{r.respostaFormatada || r.texto}</p>
              {r.enviadaPor && <p className="text-xs text-muted-foreground">por {r.enviadaPor}</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
