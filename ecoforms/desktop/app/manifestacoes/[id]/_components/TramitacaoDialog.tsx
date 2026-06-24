import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Tramitacao } from "@/src/domain/ouvidoria/ManifestacaoRepository";

interface TramitacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipoEncaminhar: 'encaminhamento' | 'transferencia' | 'devolucao' | 'cobranca';
  setTipoEncaminhar: (v: 'encaminhamento' | 'transferencia' | 'devolucao' | 'cobranca') => void;
  encaminharSetorId: string;
  setEncaminharSetorId: (v: string) => void;
  encaminharObs: string;
  setEncaminharObs: (v: string) => void;
  setorOrigemDevolucao: { deSetorId?: string | null; deSetorNome?: string | null } | null;
  setores: { id: string; nome: string }[];
  manifestacaoSetorId?: string;
  onConfirm: (tramitacoes: Tramitacao[]) => void;
  tramitacoes: Tramitacao[];
  saving: boolean;
}

export function TramitacaoDialog({
  open, onOpenChange,
  tipoEncaminhar, setTipoEncaminhar,
  encaminharSetorId, setEncaminharSetorId,
  encaminharObs, setEncaminharObs,
  setorOrigemDevolucao, setores, manifestacaoSetorId,
  onConfirm, tramitacoes, saving,
}: TramitacaoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onOpenChange(false); setEncaminharSetorId(""); setEncaminharObs(""); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Tramitação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de tramitação</Label>
              <Select value={tipoEncaminhar} onValueChange={v => { setTipoEncaminhar(v as typeof tipoEncaminhar); setEncaminharSetorId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="encaminhamento">Encaminhamento</SelectItem>
                  <SelectItem value="transferencia">Transferência Setorial</SelectItem>
                  <SelectItem value="devolucao">Devolução</SelectItem>
                  <SelectItem value="cobranca">Cobrança</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {tipoEncaminhar === 'devolucao' ? (
              <div className="space-y-2">
                <Label>Devolver para</Label>
                {setorOrigemDevolucao?.deSetorNome ? (
                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    <span className="font-medium">{setorOrigemDevolucao.deSetorNome}</span>
                    <span className="text-xs text-muted-foreground">(setor de origem da última tramitação)</span>
                  </div>
                ) : (
                  <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    Nenhuma tramitação anterior encontrada — não é possível devolver.
                  </div>
                )}
              </div>
            ) : tipoEncaminhar !== 'cobranca' ? (
              <div className="space-y-2">
                <Label>Setor de destino <span className="text-destructive">*</span></Label>
                <select
                  value={encaminharSetorId}
                  onChange={e => setEncaminharSetorId(e.target.value)}
                  className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                >
                  <option value="">Selecione o setor...</option>
                  {setores
                    .filter(s => tipoEncaminhar === 'transferencia' ? s.id !== manifestacaoSetorId : true)
                    .map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea
              value={encaminharObs}
              onChange={e => setEncaminharObs(e.target.value)}
              placeholder={
                tipoEncaminhar === 'transferencia' ? "Motivo da transferência..." :
                tipoEncaminhar === 'devolucao' ? "Descreva o que precisa ser refeito..." :
                tipoEncaminhar === 'cobranca' ? "Detalhes da cobrança..." :
                "Observação do encaminhamento..."
              }
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onOpenChange(false); setEncaminharSetorId(""); setEncaminharObs(""); }}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm(tramitacoes)} disabled={saving}>
            Registrar Tramitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
