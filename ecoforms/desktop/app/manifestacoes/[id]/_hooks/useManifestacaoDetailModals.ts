import { useState } from "react";
import { uuidv7 } from 'ecoforms-core';
import { toast } from "sonner";
import {
  useManifestacaoMutations,
  useModelosResposta,
} from "@/src/interface/hooks/catalog/manifestacoes";
import { useAnexoUpload } from "@/src/interface/hooks/catalog/forms";
import { useSetores } from "@/src/interface/hooks/catalog/auth";
import type {
  ManifestacaoSummary, Tramitacao, Resposta, Despacho, Prazo, EnvioResposta, CanalEnvio,
} from "@/src/domain/ouvidoria/ManifestacaoRepository";
import { ManifestacaoStateMachine } from "@/src/domain/ouvidoria/ManifestacaoStateMachine";
import { resolveSetorDevolucao } from "@/src/domain/ouvidoria/ManifestacaoWorkflowPolicy";
import type { ManifestacaoStatus } from "@/src/domain/ouvidoria/ManifestacaoStateMachine";
import type { PerfilUsuario } from "@/src/interface/workflow/ManifestacaoWorkflowConfig";
import { useManifestacaoWorkflow } from "@/src/interface/hooks/catalog/utils";

interface UseManifestacaoDetailModalsParams {
  id: string | null;
  userId: string | undefined;
  userPerfil: string | undefined;
  manifestacao: ManifestacaoSummary | null;
  respostasFormatadasCount: number;
  refetchManifestacao: () => void;
  refetchTramitacoes: () => void;
  refetchRespostas: () => void;
  refetchDespachos: () => void;
  refetchPrazos: () => void;
  refetchAnexos: () => void;
  refetchEnvios: () => void;
}

export function useManifestacaoDetailModals({
  id, userId, userPerfil, manifestacao, respostasFormatadasCount,
  refetchManifestacao, refetchTramitacoes, refetchRespostas,
  refetchDespachos, refetchPrazos, refetchAnexos, refetchEnvios,
}: UseManifestacaoDetailModalsParams) {
  const mutations = useManifestacaoMutations();
  const {
    addTramitacao, addResposta, addDespacho, removeAnexo, addPrazo,
    updateStatus, classificar, formatarResposta, registrarEnvio,
    verificarCompetencia, criarDemandaDeManifestacao,
    loading: saving,
  } = mutations;
  const { upload: uploadAnexo, uploading: uploadingAnexo } = useAnexoUpload();
  const { data: setores } = useSetores();

  const [activeTab, setActiveTab] = useState("tramitacoes");

  const [respostaText, setRespostaText] = useState("");
  const [despachoText, setDespachoText] = useState("");
  const [prazoData, setPrazoData] = useState("");
  const [prazoTipo, setPrazoTipo] = useState("resposta");

  const [showTramitacao, setShowTramitacao] = useState(false);
  const [encaminharSetorId, setEncaminharSetorId] = useState("");
  const [encaminharObs, setEncaminharObs] = useState("");
  const [tipoEncaminhar, setTipoEncaminhar] = useState<'encaminhamento' | 'transferencia' | 'devolucao' | 'cobranca'>('encaminhamento');

  const [showCompetencia, setShowCompetencia] = useState(false);
  const [competenciaOpcao, setCompetenciaOpcao] = useState<'compete' | 'nao_compete' | ''>('');
  const [competenciaMotivo, setCompetenciaMotivo] = useState("");

  const [showEditor, setShowEditor] = useState(false);
  const [editorRespostaId, setEditorRespostaId] = useState<string | null>(null);
  const [editorModeloId, setEditorModeloId] = useState("");
  const [editorTexto, setEditorTexto] = useState("");
  const { data: modelos } = useModelosResposta(undefined);

  const [showEnviar, setShowEnviar] = useState(false);
  const [enviarRespostaId, setEnviarRespostaId] = useState<string | null>(null);
  const [enviarCanal, setEnviarCanal] = useState<CanalEnvio>('email');
  const [enviarDestinatario, setEnviarDestinatario] = useState("");

  const [showCancelar, setShowCancelar] = useState(false);
  const [cancelarMotivo, setCancelarMotivo] = useState("");

  const [showReabrir, setShowReabrir] = useState(false);

  const [despachoComDemanda, setDespachoComDemanda] = useState(false);
  const [demandaSetorId, setDemandaSetorId] = useState("");
  const [demandaTipoAcao, setDemandaTipoAcao] = useState("analise");

  const [classAssuntoId, setClassAssuntoId] = useState(
    manifestacao?.competencia === 'compete' ? (manifestacao?.subassuntoId ?? "") : ""
  );
  const [classSubassuntoId, setClassSubassuntoId] = useState("");
  const [classSubunidadeId, setClassSubunidadeId] = useState("");
  const [classProgramaId, setClassProgramaId] = useState("");

  const workflow = useManifestacaoWorkflow({
    status: (manifestacao?.status ?? 'aberta') as ManifestacaoStatus,
    competencia: manifestacao?.competencia,
    aceiteEm: manifestacao?.aceiteEm,
    respostasFormatadas: respostasFormatadasCount,
    userPerfil: userPerfil as PerfilUsuario | undefined,
  });

  const setorOrigemDevolucao = resolveSetorDevolucao(
    [], manifestacao?.setorId ?? null
  );

  const handleAddResposta = async () => {
    if (!id || !userId || !respostaText.trim()) return;
    if (respostaText.length > 5000) { toast.error("O texto da resposta excede o limite de 5000 caracteres."); return; }
    try {
      await addResposta({
        id: uuidv7(),
        manifestacaoId: id!,
        texto: respostaText,
        enviadaPorId: userId,
        enviadaEm: new Date().toISOString(),
      } satisfies Resposta);
      toast.success("Resposta registrada");
      setRespostaText("");
      refetchRespostas();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[ManifestacaoDetail] addResposta falhou:", err);
      toast.error(`Erro ao registrar resposta: ${msg}`);
    }
  };

  const handleAddDespacho = async () => {
    if (!id || !userId || !despachoText.trim()) return;
    if (despachoText.length > 5000) { toast.error("O texto do despacho excede o limite de 5000 caracteres."); return; }
    if (despachoComDemanda && !demandaSetorId) {
      toast.error("Selecione o setor para criar a demanda");
      return;
    }
    try {
      await addDespacho({
        id: uuidv7(),
        manifestacaoId: id!,
        texto: despachoText,
        despachadoPorId: userId,
        despachadoEm: new Date().toISOString(),
      } satisfies Despacho);

      if (despachoComDemanda && demandaSetorId) {
        await criarDemandaDeManifestacao({
          manifestacaoId: id!,
          solicitanteId: userId,
          destinatarioId: demandaSetorId,
          descricao: despachoText,
          tipoAcao: demandaTipoAcao,
        });
        const setorNome = setores.find(s => s.id === demandaSetorId)?.nome ?? demandaSetorId;
        toast.success(`Despacho registrado — demanda criada para ${setorNome}`);
        setDespachoComDemanda(false);
        setDemandaSetorId("");
      } else {
        toast.success("Despacho registrado");
      }

      setDespachoText("");
      refetchDespachos();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[ManifestacaoDetail] addDespacho falhou:", err);
      toast.error(`Erro ao registrar despacho: ${msg}`);
    }
  };

  const handleAddPrazo = async () => {
    if (!id || !userId || !prazoData) return;
    try {
      await addPrazo({
        id: uuidv7(),
        manifestacaoId: id!,
        tipoPrazo: prazoTipo,
        dataLimite: prazoData,
        status: "pendente",
        criadoEm: new Date().toISOString(),
      } as Prazo);
      toast.success("Prazo adicionado");
      setPrazoData("");
      refetchPrazos();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[ManifestacaoDetail] addPrazo falhou:", err);
      toast.error(`Erro ao adicionar prazo: ${msg}`);
    }
  };

  const handleRemoveAnexo = async (anexoId: string) => {
    try {
      await removeAnexo(anexoId);
      toast.success("Anexo removido");
      refetchAnexos();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[ManifestacaoDetail] removeAnexo falhou:", err);
      toast.error(`Erro ao remover anexo: ${msg}`);
    }
  };

  const handleAbrirEditor = (respostaId: string, textoAtual: string) => {
    setEditorRespostaId(respostaId);
    setEditorTexto(textoAtual);
    setEditorModeloId("");
    setShowEditor(true);
  };

  const handleSalvarResposta = async (marcarRespondida: boolean) => {
    if (!id || !userId) return;
    if (!editorRespostaId) { toast.error("Nenhuma resposta selecionada para formatar"); return; }
    if (!editorTexto.trim()) {
      toast.error("Texto da resposta é obrigatório");
      return;
    }
    try {
      await formatarResposta(id!, {
        respostaId: editorRespostaId,
        respostaFormatada: editorTexto,
        modeloId: editorModeloId || undefined,
        revisadaPorId: userId,
        marcarRespondida,
      });
      toast.success(marcarRespondida ? "Resposta enviada — manifestação marcada como Respondida" : "Rascunho salvo");
      setShowEditor(false);
      refetchRespostas();
      refetchManifestacao();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar resposta");
    }
  };

  const handleEnviarCidadao = async (respostas: Resposta[]) => {
    if (!id || !userId || !manifestacao) return;
    if (!enviarRespostaId) { toast.error("Nenhuma resposta selecionada para envio"); return; }
    if (enviarCanal === 'email' && !enviarDestinatario.trim()) {
      toast.error("Informe o e-mail do destinatário");
      return;
    }
    if (enviarCanal === 'whatsapp' && !enviarDestinatario.trim()) {
      toast.error("Informe o número do WhatsApp");
      return;
    }

    const respostaAtual = respostas.find(r => r.id === enviarRespostaId);
    const textoEnvio = respostaAtual?.respostaFormatada || respostaAtual?.texto || "";

    if (enviarCanal === 'whatsapp') {
      const digits = enviarDestinatario.replace(/\D/g, '');
      const phone = digits.startsWith('55') ? digits : `55${digits}`;
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(textoEnvio)}`;
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_whatsapp_url', { phone: enviarDestinatario, text: textoEnvio });
      } catch {
        window.open(waUrl, '_blank');
      }
      await registrarEnvio({
        id: uuidv7(),
        respostaId: enviarRespostaId,
        manifestacaoId: id!,
        canal: 'whatsapp',
        destinatario: enviarDestinatario,
        statusEnvio: 'enviado',
        dataEnvio: new Date().toISOString(),
        erro: null,
      } satisfies EnvioResposta);
      toast.success("WhatsApp aberto — envio registrado");
      setShowEnviar(false);
      setEnviarRespostaId(null);
      setEnviarDestinatario("");
      refetchEnvios();
      return;
    }

    if (enviarCanal === 'email') {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('send_email', {
          to: enviarDestinatario,
          subject: `Resposta à manifestação ${manifestacao.protocolo}`,
          body: textoEnvio,
        });
        toast.success("E-mail enviado com sucesso");
      } catch (e) {
        const errMsg = typeof e === 'string' ? e : e instanceof Error ? e.message : "Erro ao enviar e-mail";
        await registrarEnvio({
          id: uuidv7(),
          respostaId: enviarRespostaId,
          manifestacaoId: id!,
          canal: 'email',
          destinatario: enviarDestinatario,
          statusEnvio: 'falha',
          dataEnvio: new Date().toISOString(),
          erro: errMsg,
        } satisfies EnvioResposta);
        toast.error(errMsg);
        refetchEnvios();
        return;
      }
    }

    try {
      await registrarEnvio({
        id: uuidv7(),
        respostaId: enviarRespostaId,
        manifestacaoId: id!,
        canal: enviarCanal,
        destinatario: enviarDestinatario || null,
        statusEnvio: 'enviado',
        dataEnvio: new Date().toISOString(),
        erro: null,
      } satisfies EnvioResposta);
      toast.success(`Envio registrado via ${enviarCanal}`);
      setShowEnviar(false);
      setEnviarRespostaId(null);
      setEnviarDestinatario("");
      refetchEnvios();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar envio");
    }
  };

  const handleEnviarAvaliacao = async () => {
    try {
      await updateStatus(id!, 'em_avaliacao');
      toast.success("Manifestação enviada para avaliação do cidadão");
      refetchManifestacao();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao atualizar status");
    }
  };

  const handleEncerrar = async () => {
    try {
      await updateStatus(id!, 'encerrada');
      toast.success("Manifestação encerrada");
      refetchManifestacao();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao encerrar");
    }
  };

  const handleReativarDevolvida = async () => {
    try {
      await updateStatus(id!, 'em_analise', userId!);
      toast.success("Manifestação reativada — em análise");
      refetchManifestacao();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao reativar");
    }
  };

  const handleCancelar = async () => {
    if (!cancelarMotivo.trim()) { toast.error("Informe o motivo do cancelamento"); return; }
    try {
      await updateStatus(id!, 'cancelada');
      await addDespacho({
        id: uuidv7(),
        manifestacaoId: id!,
        texto: `Cancelamento: ${cancelarMotivo}`,
        despachadoPorId: userId!,
        despachadoEm: new Date().toISOString(),
      } satisfies Despacho);
      toast.success("Manifestação cancelada");
      setShowCancelar(false);
      setCancelarMotivo("");
      refetchManifestacao();
      refetchDespachos();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cancelar");
    }
  };

  const handleClassificar = async () => {
    if (!id || !userId) return;
    try {
      await classificar(id!, {
        subassuntoId: classSubassuntoId || undefined,
        subunidadeId: classSubunidadeId || undefined,
        programaOrcamentarioId: classProgramaId || undefined,
      });
      toast.success("Manifestação classificada e encaminhada para atendimento");
      refetchManifestacao();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao classificar");
    }
  };

  const handleConfirmarCompetencia = async () => {
    if (!competenciaOpcao) { toast.error("Selecione uma opção"); return; }
    if (competenciaOpcao === 'nao_compete' && !competenciaMotivo.trim()) {
      toast.error("Motivo é obrigatório ao encaminhar para a Ouvidoria da SEMA");
      return;
    }
    try {
      if (competenciaOpcao === 'nao_compete') {
        await updateStatus(id!, 'encaminhado_sema');
        await verificarCompetencia(id!, 'nao_compete', competenciaMotivo, 'Ouvidoria da Secretaria de Meio Ambiente');
        await addTramitacao({
          id: uuidv7(),
          manifestacaoId: id!,
          deSetorId: manifestacao!.setorId ?? null,
          paraSetorId: manifestacao!.setorId ?? '',
          observacao: `Encaminhado para Ouvidoria da SEMA. Motivo: ${competenciaMotivo}`,
          usuarioId: userId!,
          tipoTramitacao: 'transferencia',
          criadoEm: new Date().toISOString(),
        } satisfies Tramitacao);
        toast.success("Manifestação encaminhada para a Ouvidoria da SEMA");
      } else {
        await verificarCompetencia(id!, 'compete');
        if (ManifestacaoStateMachine.podeTransitar(manifestacao!.status, 'em_analise')) {
          await updateStatus(id!, 'em_analise', userId!);
        }
        toast.success("Competência confirmada — manifestação em análise");
      }
      setShowCompetencia(false);
      setCompetenciaOpcao('');
      setCompetenciaMotivo('');
      refetchManifestacao();
      refetchTramitacoes();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao registrar competência");
    }
  };

  const handleEncaminhar = async (tramitacoes: Tramitacao[]) => {
    if (!id || !userId || !manifestacao) return;
    const setorOrigem = resolveSetorDevolucao(tramitacoes, manifestacao.setorId ?? null);
    if (tipoEncaminhar === 'devolucao') {
      if (!setorOrigem?.deSetorId) {
        toast.error("Não há tramitação anterior — não é possível devolver sem um setor de origem");
        return;
      }
    } else if (tipoEncaminhar !== 'cobranca' && !encaminharSetorId) {
      toast.error("Selecione o setor de destino");
      return;
    }
    if (tipoEncaminhar === 'transferencia' && encaminharSetorId === manifestacao.setorId) {
      toast.error("A transferência exige um setor diferente do atual");
      return;
    }
    const obsDefault: Record<string, string> = {
      encaminhamento: "Encaminhamento para área interna",
      transferencia: "Transferência setorial",
      devolucao: `Devolução para ${setorOrigem?.deSetorNome ?? "setor de origem"}`,
      cobranca: "Cobrança por prazo vencido",
    };
    const paraSetorId =
      tipoEncaminhar === 'devolucao' ? setorOrigem!.deSetorId! :
      tipoEncaminhar === 'cobranca'  ? (manifestacao.setorId ?? '') :
      encaminharSetorId;
    try {
      await addTramitacao({
        id: uuidv7(),
        manifestacaoId: id!,
        deSetorId: manifestacao.setorId ?? null,
        paraSetorId,
        observacao: encaminharObs || obsDefault[tipoEncaminhar],
        usuarioId: userId,
        tipoTramitacao: tipoEncaminhar,
        criadoEm: new Date().toISOString(),
      } satisfies Tramitacao);
      const msgMap: Record<string, string> = {
        encaminhamento: "Encaminhamento registrado",
        transferencia: "Transferência registrada",
        devolucao: "Devolução registrada",
        cobranca: "Cobrança registrada",
      };
      toast.success(msgMap[tipoEncaminhar]);
      setEncaminharSetorId("");
      setEncaminharObs("");
      setShowTramitacao(false);
      refetchTramitacoes();
      refetchManifestacao();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error("[ManifestacaoDetail] encaminhar falhou:", err);
      toast.error(`Erro ao registrar tramitação: ${msg}`);
    }
  };

  const workflowHandlers: Record<string, () => Promise<void> | void> = {
    aceitar:            async () => { await updateStatus(id!, 'em_atendimento', userId!); toast.success("Manifestação aceita pelo responsável"); refetchManifestacao(); },
    cancelar:           () => setShowCancelar(true),
    classificar:        handleClassificar,
    encaminharSema:     () => { setCompetenciaOpcao('nao_compete'); setShowCompetencia(true); },
    avaliarCompetencia: () => setShowCompetencia(true),
    enviarAvaliacao:    handleEnviarAvaliacao,
    encerrar:           handleEncerrar,
    reabrir:            () => setShowReabrir(true),
    reativar:           handleReativarDevolvida,
  };

  function handleWorkflowAction(key: string) {
    const handler = workflowHandlers[key];
    if (handler) {
      const result = handler();
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).catch((e: unknown) => toast.error(e instanceof Error ? e.message : `Erro na ação ${key}`));
      }
    }
  }

  return {
    activeTab, setActiveTab,
    respostaText, setRespostaText,
    despachoText, setDespachoText,
    prazoData, setPrazoData,
    prazoTipo, setPrazoTipo,
    showTramitacao, setShowTramitacao,
    encaminharSetorId, setEncaminharSetorId,
    encaminharObs, setEncaminharObs,
    tipoEncaminhar, setTipoEncaminhar,
    showCompetencia, setShowCompetencia,
    competenciaOpcao, setCompetenciaOpcao,
    competenciaMotivo, setCompetenciaMotivo,
    showEditor, setShowEditor,
    editorRespostaId, setEditorRespostaId,
    editorModeloId, setEditorModeloId,
    editorTexto, setEditorTexto,
    modelos,
    showEnviar, setShowEnviar,
    enviarRespostaId, setEnviarRespostaId,
    enviarCanal, setEnviarCanal,
    enviarDestinatario, setEnviarDestinatario,
    showCancelar, setShowCancelar,
    cancelarMotivo, setCancelarMotivo,
    showReabrir, setShowReabrir,
    despachoComDemanda, setDespachoComDemanda,
    demandaSetorId, setDemandaSetorId,
    demandaTipoAcao, setDemandaTipoAcao,
    classAssuntoId, setClassAssuntoId,
    classSubassuntoId, setClassSubassuntoId,
    classSubunidadeId, setClassSubunidadeId,
    classProgramaId, setClassProgramaId,
    workflow,
    setorOrigemDevolucao,
    saving,
    uploadAnexo,
    uploadingAnexo,
    setores,
    handleAddResposta,
    handleAddDespacho,
    handleAddPrazo,
    handleRemoveAnexo,
    handleAbrirEditor,
    handleSalvarResposta,
    handleEnviarCidadao,
    handleCancelar,
    handleClassificar,
    handleConfirmarCompetencia,
    handleEncaminhar,
    handleWorkflowAction,
  };
}
