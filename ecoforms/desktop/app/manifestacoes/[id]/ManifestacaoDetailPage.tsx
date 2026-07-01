"use client";

import { useRouteParamOrQuery } from "@/src/interface/hooks/routing/useRouteParamOrQuery";
import { ArrowLeft, Send, Clock, Paperclip, History, MessageSquare, ShieldCheck, Bell, Mail } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useManifestacaoById, useManifestacaoTramitacoes, useManifestacaoRespostas, useManifestacaoDespachos, useManifestacaoPrazos, useManifestacaoAnexos, useManifestacaoCobranças, useManifestacaoEnvios } from "@/src/interface/hooks/catalog/manifestacoes";
import { useNotificacoesSolicitante } from "@/src/interface/hooks/catalog/manifestacoes";
import { useManifestacaoCatalogos } from "@/src/interface/hooks/catalog/manifestacoes";
import { useSubassuntos, useSubunidades, useProgramasOrcamentarios } from "@/src/interface/hooks/catalog/manifestacoes";
import { useAuth } from "@/src/interface/hooks/catalog/auth";
import { ManifestacaoWorkflowActions } from "@/components/ouvidoria/ManifestacaoWorkflowActions";
import { DadosManifestacaoCard } from "./_components/DadosManifestacaoCard";
import { ClassificacaoCompetenciaForm } from "./_components/ClassificacaoCompetenciaForm";
import { CompetenciaDialog } from "./_components/CompetenciaDialog";
import { CancelarDialog } from "./_components/CancelarDialog";
import { TramitacoesTab } from "./_components/TramitacoesTab";
import { RespostasTab } from "./_components/RespostasTab";
import { DespachosTab } from "./_components/DespachosTab";
import { PrazosTab } from "./_components/PrazosTab";
import { AnexosTab } from "./_components/AnexosTab";
import { CobrancasTab } from "./_components/CobrancasTab";
import { NotificacoesTab } from "./_components/NotificacoesTab";
import { useManifestacaoDetailModals } from "./_hooks/useManifestacaoDetailModals";

export default function ManifestacaoDetailPage() {
  const id = useRouteParamOrQuery("id");
  const { user } = useAuth();
  const { manifestacao, loading, refetch: refetchManifestacao } = useManifestacaoById(id);
  const { data: tramitacoes, refetch: refetchTramitacoes } = useManifestacaoTramitacoes(id);
  const { data: respostas, refetch: refetchRespostas } = useManifestacaoRespostas(id);
  const { data: despachos, refetch: refetchDespachos } = useManifestacaoDespachos(id);
  const { data: prazos, refetch: refetchPrazos } = useManifestacaoPrazos(id);
  const { data: anexos, refetch: refetchAnexos } = useManifestacaoAnexos(id);
  const { data: cobranças } = useManifestacaoCobranças(id);
  const { data: envios, refetch: refetchEnvios } = useManifestacaoEnvios(id);
  const { data: notificacoes } = useNotificacoesSolicitante(id!);
  const { classificacoes } = useManifestacaoCatalogos();
  const { data: subassuntos } = useSubassuntos(manifestacao?.competencia === 'compete' ? (manifestacao?.subassuntoId ?? "") : undefined);
  const { data: subunidades } = useSubunidades(manifestacao?.setorId || undefined);
  const { data: programas } = useProgramasOrcamentarios();

  const modals = useManifestacaoDetailModals({
    id,
    userId: user?.id,
    userPerfil: user?.perfil,
    manifestacao,
    respostasFormatadasCount: respostas.filter(r => r.respostaFormatada).length,
    refetchManifestacao: refetchManifestacao ?? (() => {}),
    refetchTramitacoes: refetchTramitacoes ?? (() => {}),
    refetchRespostas: refetchRespostas ?? (() => {}),
    refetchDespachos: refetchDespachos ?? (() => {}),
    refetchPrazos: refetchPrazos ?? (() => {}),
    refetchAnexos: refetchAnexos ?? (() => {}),
    refetchEnvios: refetchEnvios ?? (() => {}),
  });

  if (loading) return <p className="p-8">Carregando...</p>;
  if (!manifestacao) return <p className="p-8">Manifestação não encontrada.</p>;

  const { actions, showFluxo, canClassificar, isTerminal, badgeVariant, canEdit, canResponder, showEncaminhadoSemaBadge } = modals.workflow;

  return (
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/manifestacoes">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{manifestacao.protocolo}</h1>
          <p className="text-sm text-muted-foreground">{manifestacao.assunto}</p>
        </div>
        <Badge variant={badgeVariant}>{manifestacao.status}</Badge>
        {!isTerminal &&
          (user?.perfil === 'admin' || user?.perfil === 'gerente' || user?.perfil === 'coordenador') && (
          <div className="flex gap-2">
            {!manifestacao.competencia && (
              <Button size="sm" variant="outline" onClick={() => modals.setShowCompetencia(true)}>
                <ShieldCheck className="h-4 w-4 mr-1" />Avaliar Competência
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-orange-600 border-orange-300 hover:bg-orange-50"
              onClick={() => { modals.setCompetenciaOpcao('nao_compete'); modals.setShowCompetencia(true); }}
            >
              <Send className="h-4 w-4 mr-1" />Encaminhar para outra Ouvidoria
            </Button>
          </div>
        )}
        {manifestacao.competencia === 'compete' && (
          <Badge variant="outline" className="text-green-700 border-green-400">Competência confirmada</Badge>
        )}
        {showEncaminhadoSemaBadge && (
          <Badge variant="secondary">Encaminhado à SEMA</Badge>
        )}
      </div>

      <DadosManifestacaoCard manifestacao={manifestacao} />

      {showFluxo && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Ações do Fluxo</CardTitle>
          </CardHeader>
          <CardContent>
            <ManifestacaoWorkflowActions
              actions={actions}
              onAction={modals.handleWorkflowAction}
              disabled={modals.saving}
            />
          </CardContent>
        </Card>
      )}

      {canClassificar && (
        <ClassificacaoCompetenciaForm
          manifestacao={manifestacao}
          classificacoes={classificacoes}
          subassuntos={subassuntos ?? []}
          subunidades={subunidades ?? []}
          programas={programas ?? []}
          classAssuntoId={modals.classAssuntoId}
          classSubassuntoId={modals.classSubassuntoId}
          classSubunidadeId={modals.classSubunidadeId}
          classProgramaId={modals.classProgramaId}
          setClassAssuntoId={modals.setClassAssuntoId}
          setClassSubassuntoId={modals.setClassSubassuntoId}
          setClassSubunidadeId={modals.setClassSubunidadeId}
          setClassProgramaId={modals.setClassProgramaId}
          onClassificar={modals.handleClassificar}
          saving={modals.saving}
        />
      )}

      <CompetenciaDialog
        open={modals.showCompetencia}
        onOpenChange={modals.setShowCompetencia}
        competenciaOpcao={modals.competenciaOpcao}
        setCompetenciaOpcao={modals.setCompetenciaOpcao}
        competenciaMotivo={modals.competenciaMotivo}
        setCompetenciaMotivo={modals.setCompetenciaMotivo}
        onConfirm={modals.handleConfirmarCompetencia}
        saving={modals.saving}
      />

      <CancelarDialog
        open={modals.showCancelar}
        onOpenChange={modals.setShowCancelar}
        cancelarMotivo={modals.cancelarMotivo}
        setCancelarMotivo={modals.setCancelarMotivo}
        onConfirm={modals.handleCancelar}
        saving={modals.saving}
      />

      <Tabs value={modals.activeTab} onValueChange={modals.setActiveTab}>
        <TabsList>
          <TabsTrigger value="tramitacoes"><History className="h-4 w-4 mr-1" />Tramitações</TabsTrigger>
          <TabsTrigger value="respostas">
            <MessageSquare className="h-4 w-4 mr-1" />Respostas
            {respostas.filter(r => !r.respostaFormatada).length > 0 && (
              <span className="ml-1 rounded-full bg-secondary text-secondary-foreground text-xs px-1.5">
                {respostas.filter(r => !r.respostaFormatada).length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="despachos"><Send className="h-4 w-4 mr-1" />Despachos</TabsTrigger>
          <TabsTrigger value="prazos"><Clock className="h-4 w-4 mr-1" />Prazos</TabsTrigger>
          <TabsTrigger value="anexos"><Paperclip className="h-4 w-4 mr-1" />Anexos</TabsTrigger>
          <TabsTrigger value="cobranças">
            <Bell className="h-4 w-4 mr-1" />
            Cobranças
            {cobranças.length > 0 && (
              <span className="ml-1 rounded-full bg-destructive text-destructive-foreground text-xs px-1.5">{cobranças.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="notificacoes"><Mail className="h-4 w-4 mr-1" />Notificações</TabsTrigger>
        </TabsList>

        <TabsContent value="tramitacoes">
          <TramitacoesTab
            tramitacoes={tramitacoes}
            isTerminal={isTerminal}
            userPerfil={user?.perfil}
            showTramitacao={modals.showTramitacao}
            setShowTramitacao={modals.setShowTramitacao}
            tipoEncaminhar={modals.tipoEncaminhar}
            setTipoEncaminhar={modals.setTipoEncaminhar}
            setActiveTab={modals.setActiveTab}
            encaminharSetorId={modals.encaminharSetorId}
            setEncaminharSetorId={modals.setEncaminharSetorId}
            encaminharObs={modals.encaminharObs}
            setEncaminharObs={modals.setEncaminharObs}
            setorOrigemDevolucao={modals.setorOrigemDevolucao}
            setores={modals.setores ?? []}
            manifestacaoSetorId={manifestacao.setorId}
            handleEncaminhar={modals.handleEncaminhar}
            saving={modals.saving}
          />
        </TabsContent>

        <TabsContent value="respostas">
          <RespostasTab
            respostas={respostas}
            envios={envios}
            manifestacao={manifestacao}
            canEdit={canEdit}
            canResponder={canResponder}
            respostaText={modals.respostaText}
            setRespostaText={modals.setRespostaText}
            handleAddResposta={modals.handleAddResposta}
            showEditor={modals.showEditor}
            setShowEditor={modals.setShowEditor}
            editorModeloId={modals.editorModeloId}
            setEditorModeloId={modals.setEditorModeloId}
            editorTexto={modals.editorTexto}
            setEditorTexto={modals.setEditorTexto}
            modelos={modals.modelos ?? []}
            handleSalvarResposta={modals.handleSalvarResposta}
            showEnviar={modals.showEnviar}
            setShowEnviar={modals.setShowEnviar}
            setEnviarRespostaId={modals.setEnviarRespostaId}
            enviarCanal={modals.enviarCanal}
            setEnviarCanal={modals.setEnviarCanal}
            enviarDestinatario={modals.enviarDestinatario}
            setEnviarDestinatario={modals.setEnviarDestinatario}
            handleEnviarCidadao={modals.handleEnviarCidadao}
            handleAbrirEditor={modals.handleAbrirEditor}
            saving={modals.saving}
          />
        </TabsContent>

        <TabsContent value="despachos">
          <DespachosTab
            despachos={despachos}
            userPerfil={user?.perfil}
            despachoText={modals.despachoText}
            setDespachoText={modals.setDespachoText}
            despachoComDemanda={modals.despachoComDemanda}
            setDespachoComDemanda={modals.setDespachoComDemanda}
            demandaSetorId={modals.demandaSetorId}
            setDemandaSetorId={modals.setDemandaSetorId}
            demandaTipoAcao={modals.demandaTipoAcao}
            setDemandaTipoAcao={modals.setDemandaTipoAcao}
            setores={modals.setores ?? []}
            handleAddDespacho={modals.handleAddDespacho}
            saving={modals.saving}
          />
        </TabsContent>

        <TabsContent value="prazos">
          <PrazosTab
            prazos={prazos}
            prazoData={modals.prazoData}
            setPrazoData={modals.setPrazoData}
            prazoTipo={modals.prazoTipo}
            setPrazoTipo={modals.setPrazoTipo}
            handleAddPrazo={modals.handleAddPrazo}
            saving={modals.saving}
          />
        </TabsContent>

        <TabsContent value="anexos">
          <AnexosTab
            anexos={anexos}
            manifestacaoId={id}
            uploadAnexo={modals.uploadAnexo}
            uploadingAnexo={modals.uploadingAnexo}
            handleRemoveAnexo={modals.handleRemoveAnexo}
            refetchAnexos={refetchAnexos}
            saving={modals.saving}
          />
        </TabsContent>

        <TabsContent value="cobranças">
          <CobrancasTab cobranças={cobranças} />
        </TabsContent>

        <TabsContent value="notificacoes">
          <NotificacoesTab notificacoes={notificacoes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
