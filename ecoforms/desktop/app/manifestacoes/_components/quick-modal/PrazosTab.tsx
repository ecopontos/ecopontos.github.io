import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ManifestacaoSummary, Prazo } from "@/src/domain/ouvidoria/ManifestacaoRepository";
import { isManifestacaoTerminal } from "@/src/domain/ouvidoria/ManifestacaoWorkflowPolicy";

interface PrazosTabProps {
  selected: ManifestacaoSummary;
  prazos: Prazo[];
  prazoData: string;
  onPrazoDataChange: (value: string) => void;
  prazoTipo: string;
  onPrazoTipoChange: (value: string) => void;
  onAddPrazo: () => void;
  onMarcarCumprido: (prazoId: string) => void;
  saving: boolean;
}

const TIPO_LABEL: Record<string, string> = {
  resposta: "Resposta ao Cidadão",
  solucao: "Solução do Problema",
  prorrogacao: "Prorrogação Administrativa",
};

/** Aba "Prazos": registro de novos prazos + acompanhamento. */
export function PrazosTab({
  selected, prazos,
  prazoData, onPrazoDataChange, prazoTipo, onPrazoTipoChange,
  onAddPrazo, onMarcarCumprido, saving,
}: PrazosTabProps) {
  return (
    <>
      {!isManifestacaoTerminal(selected.status) && (
        <div className="rounded-md border p-4 space-y-3 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Novo prazo</p>
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <Input
                type="date"
                value={prazoData}
                onChange={e => onPrazoDataChange(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="w-52">
              <Select value={prazoTipo} onValueChange={onPrazoTipoChange}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="resposta">Resposta ao Cidadão</SelectItem>
                  <SelectItem value="solucao">Solução do Problema</SelectItem>
                  <SelectItem value="prorrogacao">Prorrogação Administrativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={onAddPrazo} disabled={saving || !prazoData}>
              Adicionar
            </Button>
          </div>
        </div>
      )}

      {prazos.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nenhum prazo registrado.</p>
      ) : (
        <div className="space-y-2">
          {prazos.map(p => {
            const vencido = p.status === 'pendente' && new Date(p.dataLimite) < new Date();
            return (
              <div key={p.id} className={`rounded-md border p-3 text-sm flex items-center justify-between gap-3 ${vencido ? 'border-red-200 bg-red-50/50' : ''}`}>
                <div className="space-y-0.5">
                  <p className="font-medium text-xs">{TIPO_LABEL[p.tipoPrazo] ?? p.tipoPrazo}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{new Date(p.dataLimite).toLocaleDateString("pt-BR")}</span>
                    {p.status === 'cumprido'
                      ? <Badge variant="outline" className="text-xs text-green-700 border-green-400">Cumprido</Badge>
                      : vencido
                      ? <Badge variant="destructive" className="text-xs">Vencido</Badge>
                      : <Badge variant="secondary" className="text-xs">Pendente</Badge>}
                  </div>
                  {p.cumpridoEm && <p className="text-xs text-muted-foreground">Cumprido em {new Date(p.cumpridoEm).toLocaleDateString("pt-BR")}</p>}
                </div>
                {p.status === 'pendente' && !isManifestacaoTerminal(selected.status) && (
                  <Button size="sm" variant="outline" className="flex-shrink-0 text-xs h-7" onClick={() => onMarcarCumprido(p.id)} disabled={saving}>
                    Marcar cumprido
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
