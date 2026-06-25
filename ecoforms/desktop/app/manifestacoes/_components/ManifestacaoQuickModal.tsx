import { Send, ExternalLink, History, MessageSquare, FileText, CalendarClock, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type {
  ManifestacaoSummary, Tramitacao, Resposta, Despacho, Prazo, Cobranca,
} from "@/src/domain/ouvidoria/ManifestacaoRepository";
import { isManifestacaoTerminal } from "@/src/domain/ouvidoria/ManifestacaoWorkflowPolicy";
import { STATUS_LABEL, statusVariant, urgencyScore } from "../_lib/helpers";
import { DemandaTab } from "./quick-modal/DemandaTab";
import { TramitacoesTab } from "./quick-modal/TramitacoesTab";
import { RespostasTab } from "./quick-modal/RespostasTab";
import { DespachosTab } from "./quick-modal/DespachosTab";
import { PrazosTab } from "./quick-modal/PrazosTab";
import { CobrancasTab } from "./quick-modal/CobrancasTab";

interface ManifestacaoQuickModalProps {
  selected: ManifestacaoSummary | null;
  modalTab: string;
  onModalTabChange: (tab: string) => void;
  onClose: () => void;
  onOpenDetail: (id: string) => void;
  podeEncaminhar: boolean;
  onAbrirEncaminhar: (m: ManifestacaoSummary, e?: React.MouseEvent) => void;
  saving: boolean;

  tramitacoes: Tramitacao[];
  respostas: Resposta[];
  despachos: Despacho[];
  prazos: Prazo[];
  cobranças: Cobranca[];

  tramObs: string;
  onTramObsChange: (value: string) => void;
  tramTipo: Tramitacao['tipoTramitacao'];
  onTramTipoChange: (value: Tramitacao['tipoTramitacao']) => void;
  onAddTramitacao: () => void;

  respTexto: string;
  onRespTextoChange: (value: string) => void;
  onAddResposta: () => void;

  despTexto: string;
  onDespTextoChange: (value: string) => void;
  onAddDespacho: () => void;

  prazoData: string;
  onPrazoDataChange: (value: string) => void;
  prazoTipo: string;
  onPrazoTipoChange: (value: string) => void;
  onAddPrazo: () => void;
  onMarcarCumprido: (prazoId: string) => void;
}

/** Modal rápido de manifestação: cabeçalho + abas (demanda/tramitações/respostas/despachos/prazos/cobranças). */
export function ManifestacaoQuickModal({
  selected, modalTab, onModalTabChange, onClose, onOpenDetail,
  podeEncaminhar, onAbrirEncaminhar, saving,
  tramitacoes, respostas, despachos, prazos, cobranças,
  tramObs, onTramObsChange, tramTipo, onTramTipoChange, onAddTramitacao,
  respTexto, onRespTextoChange, onAddResposta,
  despTexto, onDespTextoChange, onAddDespacho,
  prazoData, onPrazoDataChange, prazoTipo, onPrazoTipoChange, onAddPrazo, onMarcarCumprido,
}: ManifestacaoQuickModalProps) {
  return (
    <Dialog open={!!selected} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">

        {/* Cabeçalho fixo */}
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span className="font-mono">{selected?.protocolo}</span>
            {selected && (
              <Badge variant={statusVariant(selected.status)}>
                {STATUS_LABEL[selected.status] ?? selected.status}
              </Badge>
            )}
            {selected && urgencyScore(selected) === 0 && <Badge variant="destructive">Prazo vencido</Badge>}
            {selected?.sigiloso ? <Badge variant="destructive">Sigiloso</Badge> : null}
            {selected?.anonimo ? <Badge variant="secondary">Anônimo</Badge> : null}
          </DialogTitle>
          {selected && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">{selected.assunto}</p>
          )}
        </DialogHeader>

        {/* Tabs */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={modalTab} onValueChange={onModalTabChange} className="h-full flex flex-col">
            <TabsList className="mx-6 mt-3 flex-shrink-0 w-fit">
              <TabsTrigger value="demanda" className="text-xs">Demanda</TabsTrigger>
              <TabsTrigger value="tramitacoes" className="text-xs">
                <History className="h-3 w-3 mr-1" />Tramitações
                {tramitacoes.length > 0 && <span className="ml-1 text-xs bg-muted rounded-full px-1">{tramitacoes.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="respostas" className="text-xs">
                <MessageSquare className="h-3 w-3 mr-1" />Respostas
                {respostas.length > 0 && <span className="ml-1 text-xs bg-muted rounded-full px-1">{respostas.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="despachos" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />Despachos
                {despachos.length > 0 && <span className="ml-1 text-xs bg-muted rounded-full px-1">{despachos.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="prazos" className="text-xs">
                <CalendarClock className="h-3 w-3 mr-1" />Prazos
                {prazos.length > 0 && <span className="ml-1 text-xs bg-muted rounded-full px-1">{prazos.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="cobranças" className="text-xs">
                <Bell className="h-3 w-3 mr-1" />Cobranças
                {cobranças.length > 0 && <span className="ml-1 text-xs bg-destructive text-destructive-foreground rounded-full px-1">{cobranças.length}</span>}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto px-6 pb-4 pt-3">

              <TabsContent value="demanda" className="mt-0 space-y-4">
                {selected && <DemandaTab selected={selected} />}
              </TabsContent>

              <TabsContent value="tramitacoes" className="mt-0 space-y-4">
                {selected && (
                  <TramitacoesTab
                    selected={selected}
                    tramitacoes={tramitacoes}
                    tramObs={tramObs}
                    onTramObsChange={onTramObsChange}
                    tramTipo={tramTipo}
                    onTramTipoChange={onTramTipoChange}
                    onAddTramitacao={onAddTramitacao}
                    saving={saving}
                  />
                )}
              </TabsContent>

              <TabsContent value="respostas" className="mt-0 space-y-4">
                {selected && (
                  <RespostasTab
                    selected={selected}
                    respostas={respostas}
                    respTexto={respTexto}
                    onRespTextoChange={onRespTextoChange}
                    onAddResposta={onAddResposta}
                    saving={saving}
                  />
                )}
              </TabsContent>

              <TabsContent value="despachos" className="mt-0 space-y-4">
                {selected && (
                  <DespachosTab
                    selected={selected}
                    despachos={despachos}
                    despTexto={despTexto}
                    onDespTextoChange={onDespTextoChange}
                    onAddDespacho={onAddDespacho}
                    saving={saving}
                  />
                )}
              </TabsContent>

              <TabsContent value="prazos" className="mt-0 space-y-4">
                {selected && (
                  <PrazosTab
                    selected={selected}
                    prazos={prazos}
                    prazoData={prazoData}
                    onPrazoDataChange={onPrazoDataChange}
                    prazoTipo={prazoTipo}
                    onPrazoTipoChange={onPrazoTipoChange}
                    onAddPrazo={onAddPrazo}
                    onMarcarCumprido={onMarcarCumprido}
                    saving={saving}
                  />
                )}
              </TabsContent>

              <TabsContent value="cobranças" className="mt-0 space-y-3">
                <CobrancasTab cobranças={cobranças} />
              </TabsContent>

            </div>
          </Tabs>
        </div>

        {/* Rodapé fixo */}
        <DialogFooter className="px-6 py-3 border-t flex-shrink-0 gap-2">
          {selected && podeEncaminhar && !isManifestacaoTerminal(selected.status) && (
            <Button variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50"
              onClick={e => { onClose(); onAbrirEncaminhar(selected, e); }}>
              <Send className="h-4 w-4 mr-1" />Encaminhar outra Ouvidoria
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          {selected && (
            <Button onClick={() => { onClose(); onOpenDetail(selected.id); }}>
              <ExternalLink className="h-4 w-4 mr-1" />Página completa
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
