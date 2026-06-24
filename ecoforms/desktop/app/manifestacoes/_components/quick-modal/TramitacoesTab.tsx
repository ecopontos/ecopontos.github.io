import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ManifestacaoSummary, Tramitacao } from "@/src/domain/ouvidoria/ManifestacaoRepository";
import { isManifestacaoTerminal } from "@/src/domain/ouvidoria/ManifestacaoWorkflowPolicy";

interface TramitacoesTabProps {
  selected: ManifestacaoSummary;
  tramitacoes: Tramitacao[];
  tramObs: string;
  onTramObsChange: (value: string) => void;
  tramTipo: Tramitacao['tipoTramitacao'];
  onTramTipoChange: (value: Tramitacao['tipoTramitacao']) => void;
  onAddTramitacao: () => void;
  saving: boolean;
}

const TIPO_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  encaminhamento: { label: 'Encaminhamento', variant: 'outline' },
  transferencia:  { label: 'Transferência',  variant: 'secondary' },
  devolucao:      { label: 'Devolução',      variant: 'destructive' },
  cobranca:       { label: 'Cobrança',       variant: 'default' },
};

/** Aba "Tramitações": registro de novas tramitações + histórico. */
export function TramitacoesTab({
  selected, tramitacoes,
  tramObs, onTramObsChange, tramTipo, onTramTipoChange,
  onAddTramitacao, saving,
}: TramitacoesTabProps) {
  return (
    <>
      {!isManifestacaoTerminal(selected.status) && (
        <div className="rounded-md border p-4 space-y-3 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nova tramitação</p>
          <div className="flex gap-2 items-end">
            <div className="w-40 flex-shrink-0">
              <Select value={tramTipo} onValueChange={v => onTramTipoChange(v as Tramitacao['tipoTramitacao'])}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="encaminhamento">Encaminhamento</SelectItem>
                  <SelectItem value="devolucao">Devolução</SelectItem>
                  <SelectItem value="cobranca">Cobrança</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={tramObs}
              onChange={e => onTramObsChange(e.target.value)}
              placeholder="Observação..."
              rows={2}
              className="flex-1 min-h-0 text-sm"
            />
            <Button size="sm" onClick={onAddTramitacao} disabled={saving || !tramObs.trim()} className="self-end">
              Registrar
            </Button>
          </div>
        </div>
      )}

      {tramitacoes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma tramitação registrada.</p>
      ) : (
        <div className="space-y-2">
          {tramitacoes.map(t => {
            const tipo = t.tipoTramitacao ?? 'encaminhamento';
            const cfg = TIPO_MAP[tipo] ?? { label: tipo, variant: 'outline' as const };
            return (
              <div key={t.id} className="rounded-md border p-3 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>
                    {t.deSetorNome && <span className="text-muted-foreground text-xs">{t.deSetorNome} → {t.paraSetorNome || "—"}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{new Date(t.criadoEm).toLocaleString("pt-BR")}</span>
                </div>
                {t.observacao && <p className="text-sm text-foreground/80">{t.observacao}</p>}
                {t.usuarioNome && <p className="text-xs text-muted-foreground">por {t.usuarioNome}</p>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
