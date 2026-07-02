"use client";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useImoveisByClienteId } from "@/src/interface/hooks/catalog/clientes";
import { usePontosOperacionais } from "@/src/interface/hooks/queries/usePontoOperacional";
import { useLogisticsMutations } from "@/src/interface/hooks/catalog/logistica";

interface Props {
  open: boolean;
  onClose: () => void;
  roteiroId: string;
  clienteId: string;
  clienteNome: string;
  /** Imóvel do vínculo principal do cliente — usado como fallback quando não há override nesta parada. */
  vinculoImovelId: string | null;
  /** roteiro_clientes.imovel_id atual (override desta parada), se houver. */
  overrideImovelId: string | null;
  /** roteiro_clientes.ponto_operacional_id atual (override desta parada), se houver. */
  overridePontoOperacionalId: string | null;
  onSaved: () => void;
}

/**
 * Diálogo compartilhado (ItinerarioModal, RoteiroDetailPage) para definir um override de
 * localização por parada: escolher um imóvel diferente do vínculo principal do cliente e/ou
 * um ponto operacional específico desse imóvel. Ver Fase 3 do plano de logística.
 */
export function ParadaLocalizacaoDialog({
  open, onClose, roteiroId, clienteId, clienteNome,
  vinculoImovelId, overrideImovelId, overridePontoOperacionalId, onSaved,
}: Props) {
  const [selectedImovelId, setSelectedImovelId] = useState<string | null>(overrideImovelId ?? vinculoImovelId);
  const [selectedPontoId, setSelectedPontoId] = useState<string | null>(overridePontoOperacionalId);

  useEffect(() => {
    if (!open) return;
    setSelectedImovelId(overrideImovelId ?? vinculoImovelId);
    setSelectedPontoId(overridePontoOperacionalId);
  }, [open, overrideImovelId, overridePontoOperacionalId, vinculoImovelId]);

  const { data: vinculos } = useImoveisByClienteId(open ? clienteId : null);
  const { data: pontos } = usePontosOperacionais(selectedImovelId);
  const { updateParadaLocalizacao, loading } = useLogisticsMutations();

  async function salvar() {
    try {
      await updateParadaLocalizacao(roteiroId, clienteId, {
        imovelId: selectedImovelId,
        pontoOperacionalId: selectedPontoId,
      });
      toast.success("Localização da parada atualizada");
      onSaved();
      onClose();
    } catch {
      toast.error("Erro ao atualizar localização da parada");
    }
  }

  function removerOverride() {
    setSelectedImovelId(null);
    setSelectedPontoId(null);
  }

  function usarCentroide() {
    setSelectedPontoId(null);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Localização da parada — {clienteNome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {vinculos.length > 1 && (
            <div className="space-y-1.5">
              <Label>Imóvel</Label>
              <select
                value={selectedImovelId ?? ""}
                onChange={(e) => { setSelectedImovelId(e.target.value || null); setSelectedPontoId(null); }}
                className="w-full border rounded-md px-3 py-2"
              >
                <option value="">Vínculo principal do cliente</option>
                {vinculos.map((v) => (
                  <option key={v.imovel_id} value={v.imovel_id}>{v.imovel_nome}</option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Ponto operacional</Label>
            <select
              value={selectedPontoId ?? ""}
              onChange={(e) => setSelectedPontoId(e.target.value || null)}
              className="w-full border rounded-md px-3 py-2"
              disabled={!selectedImovelId || pontos.length === 0}
            >
              <option value="">
                {selectedImovelId ? "Usar centroide deste imóvel" : "Selecione um imóvel"}
              </option>
              {pontos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.tipo ?? "ponto"}{p.principal === 1 ? " (principal)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-between gap-2 pt-2">
            <Button size="sm" variant="ghost" onClick={removerOverride} disabled={loading}>
              Remover override
            </Button>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={usarCentroide} disabled={loading || !selectedImovelId}>
                Usar centroide
              </Button>
              <Button size="sm" onClick={salvar} disabled={loading}>
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
