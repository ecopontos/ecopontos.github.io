"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { uuidv7 } from "ecoforms-core";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogisticsMutations } from "@/src/interface/hooks/catalog/logistica";
import type { ExecucaoColeta, Roteiro } from "@/src/domain/logistics/LogisticsRepository";

interface UsuarioOption {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Quando informado, fixa o roteiro e oculta o seletor. */
  roteiroId?: string;
  /** Necessário quando `roteiroId` não é informado, para popular o seletor. */
  roteiros?: Roteiro[];
  usuarios?: UsuarioOption[];
}

export function NovaExecucaoDialog({ open, onClose, onSaved, roteiroId, roteiros, usuarios }: Props) {
  const { saveExecucao, loading: saving } = useLogisticsMutations();
  const [form, setForm] = useState<Partial<ExecucaoColeta>>({});

  const targetRoteiroId = roteiroId || form.roteiroId;

  const handleClose = () => {
    setForm({});
    onClose();
  };

  const handleSave = async () => {
    if (!targetRoteiroId || !form.dataExecucao) {
      toast.error("Selecione um roteiro e uma data");
      return;
    }
    try {
      await saveExecucao({
        id: uuidv7(),
        roteiroId: targetRoteiroId,
        dataExecucao: form.dataExecucao,
        status: "agendada",
        motoristaId: form.motoristaId || null,
        ajudanteId: form.ajudanteId || null,
        veiculo: form.veiculo || null,
        observacoes: form.observacoes || null,
      } as ExecucaoColeta);
      toast.success("Execução agendada");
      setForm({});
      onSaved();
      onClose();
    } catch {
      toast.error("Erro ao agendar execução");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Execução de Coleta</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {!roteiroId && (
            <div className="space-y-1.5">
              <Label className="text-xs">Roteiro *</Label>
              <select
                value={form.roteiroId || ""}
                onChange={(e) => setForm({ ...form, roteiroId: e.target.value })}
                className="w-full border rounded-md px-3 py-2 bg-background text-sm"
              >
                <option value="">Selecione um roteiro...</option>
                {roteiros?.map((r) => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Data *</Label>
            <Input
              type="date"
              value={form.dataExecucao || ""}
              onChange={(e) => setForm({ ...form, dataExecucao: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Motorista</Label>
              <select
                value={form.motoristaId || ""}
                onChange={(e) => setForm({ ...form, motoristaId: e.target.value || null })}
                className="w-full border rounded-md px-2 py-1.5 text-sm bg-background"
              >
                <option value="">Selecione...</option>
                {usuarios?.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ajudante</Label>
              <select
                value={form.ajudanteId || ""}
                onChange={(e) => setForm({ ...form, ajudanteId: e.target.value || null })}
                className="w-full border rounded-md px-2 py-1.5 text-sm bg-background"
              >
                <option value="">Selecione...</option>
                {usuarios?.map((u) => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Veículo (placa)</Label>
            <Input
              value={form.veiculo || ""}
              onChange={(e) => setForm({ ...form, veiculo: e.target.value })}
              placeholder="ABC-1234"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Input
              value={form.observacoes || ""}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Observações sobre a execução..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !targetRoteiroId || !form.dataExecucao}>
            <Save className="h-4 w-4 mr-1" />Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
