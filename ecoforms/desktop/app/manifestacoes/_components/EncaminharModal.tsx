import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ManifestacaoSummary } from "@/src/domain/ouvidoria/ManifestacaoRepository";

interface EncaminharModalProps {
  open: boolean;
  target: ManifestacaoSummary | null;
  motivo: string;
  onMotivoChange: (value: string) => void;
  orgao: string;
  onOrgaoChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  saving: boolean;
}

/** Modal de encaminhamento de manifestação para outra Ouvidoria. */
export function EncaminharModal({
  open, target, motivo, onMotivoChange, orgao, onOrgaoChange, onClose, onConfirm, saving,
}: EncaminharModalProps) {
  return (
    <Dialog open={open} onOpenChange={isOpen => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Encaminhar para outra Ouvidoria</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {target && (
            <div className="rounded-md bg-muted/30 border p-3 text-sm">
              <span className="font-semibold">{target.protocolo}</span>
              <span className="text-muted-foreground ml-2">— {target.assunto}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label>Órgão de destino</Label>
            <Input value={orgao} onChange={e => onOrgaoChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Motivo <span className="text-destructive">*</span></Label>
            <Textarea value={motivo} onChange={e => onMotivoChange(e.target.value)} rows={4}
              placeholder="Por que esta manifestação não é de competência desta Subsecretaria..." />
          </div>
          <p className="text-xs text-muted-foreground">
            A manifestação será marcada como <strong>Encaminhada</strong> e não receberá mais tramitações internas.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={saving || !motivo.trim()}>
            <Send className="h-4 w-4 mr-1" />Confirmar Encaminhamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
