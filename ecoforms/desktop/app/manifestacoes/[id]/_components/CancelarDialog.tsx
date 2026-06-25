import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CancelarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cancelarMotivo: string;
  setCancelarMotivo: (v: string) => void;
  onConfirm: () => void;
  saving: boolean;
}

export function CancelarDialog({
  open, onOpenChange,
  cancelarMotivo, setCancelarMotivo,
  onConfirm, saving,
}: CancelarDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar Manifestação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Esta ação encerrará o atendimento sem resposta ao cidadão. Informe o motivo do cancelamento.
          </p>
          <div className="space-y-2">
            <Label>Motivo <span className="text-destructive">*</span></Label>
            <Textarea
              value={cancelarMotivo}
              onChange={e => setCancelarMotivo(e.target.value)}
              placeholder="Descreva o motivo do cancelamento..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onOpenChange(false); setCancelarMotivo(""); }}>
            Voltar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={saving || !cancelarMotivo.trim()}>
            Confirmar Cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
