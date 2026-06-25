import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CompetenciaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competenciaOpcao: 'compete' | 'nao_compete' | '';
  setCompetenciaOpcao: (v: 'compete' | 'nao_compete' | '') => void;
  competenciaMotivo: string;
  setCompetenciaMotivo: (v: string) => void;
  onConfirm: () => void;
  saving: boolean;
}

export function CompetenciaDialog({
  open, onOpenChange,
  competenciaOpcao, setCompetenciaOpcao,
  competenciaMotivo, setCompetenciaMotivo,
  onConfirm, saving,
}: CompetenciaDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Avaliar Competência</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Esta manifestação é de competência da <strong>Subsecretaria de Resíduos</strong>?
          </p>
          <div className="flex gap-3">
            <Button
              variant={competenciaOpcao === 'compete' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => setCompetenciaOpcao('compete')}
            >
              Sim, é de nossa competência
            </Button>
            <Button
              variant={competenciaOpcao === 'nao_compete' ? 'destructive' : 'outline'}
              className="flex-1"
              onClick={() => setCompetenciaOpcao('nao_compete')}
            >
              Não — encaminhar à SEMA
            </Button>
          </div>
          {competenciaOpcao === 'nao_compete' && (
            <div className="space-y-2">
              <Label>Motivo do encaminhamento <span className="text-destructive">*</span></Label>
              <Textarea
                value={competenciaMotivo}
                onChange={e => setCompetenciaMotivo(e.target.value)}
                placeholder="Descreva por que a matéria não é de competência desta Subsecretaria..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                A manifestação será encaminhada para a <strong>Ouvidoria da Secretaria de Meio Ambiente</strong> e encerrada neste sistema.
              </p>
            </div>
          )}
          {competenciaOpcao === 'compete' && (
            <p className="text-xs text-muted-foreground">
              A competência será registrada e a manifestação passará para análise interna.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onOpenChange(false); setCompetenciaOpcao(''); setCompetenciaMotivo(''); }}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={saving || !competenciaOpcao}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
