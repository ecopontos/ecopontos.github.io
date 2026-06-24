import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ManifestacaoSummary, Despacho } from "@/src/domain/ouvidoria/ManifestacaoRepository";
import { isManifestacaoTerminal } from "@/src/domain/ouvidoria/ManifestacaoWorkflowPolicy";

interface DespachosTabProps {
  selected: ManifestacaoSummary;
  despachos: Despacho[];
  despTexto: string;
  onDespTextoChange: (value: string) => void;
  onAddDespacho: () => void;
  saving: boolean;
}

/** Aba "Despachos": registro de novo despacho + histórico. */
export function DespachosTab({
  selected, despachos, despTexto, onDespTextoChange, onAddDespacho, saving,
}: DespachosTabProps) {
  return (
    <>
      {!isManifestacaoTerminal(selected.status) && (
        <div className="rounded-md border p-4 space-y-3 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Novo despacho</p>
          <div className="flex gap-2 items-end">
            <Textarea
              value={despTexto}
              onChange={e => onDespTextoChange(e.target.value)}
              placeholder="Texto do despacho..."
              rows={3}
              className="flex-1 text-sm"
            />
            <Button size="sm" onClick={onAddDespacho} disabled={saving || !despTexto.trim()} className="self-end">
              Registrar
            </Button>
          </div>
        </div>
      )}

      {despachos.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum despacho registrado.</p>
      ) : (
        <div className="space-y-2">
          {despachos.map(d => (
            <div key={d.id} className="rounded-md border p-3 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{d.despachadoPor || "—"}</span>
                <span className="text-xs text-muted-foreground">{new Date(d.despachadoEm).toLocaleString("pt-BR")}</span>
              </div>
              <p className="text-sm text-foreground/80">{d.texto}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
