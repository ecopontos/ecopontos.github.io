import { useState } from "react";
import { uuidv7 } from 'ecoforms-core';
import { toast } from "sonner";
import {
  useManifestacaoTramitacoes,
  useManifestacaoRespostas,
  useManifestacaoDespachos,
  useManifestacaoPrazos,
  useManifestacaoCobranças,
  useManifestacaoMutations,
} from "@/src/interface/hooks/catalog/manifestacoes";
import type {
  ManifestacaoSummary, Tramitacao, Resposta, Despacho, Prazo,
} from "@/src/domain/ouvidoria/ManifestacaoRepository";

interface UseManifestacaoListModalsParams {
  userId: string | undefined;
  refetchList: () => void;
  mutations: ReturnType<typeof useManifestacaoMutations>;
}

/** Estado e handlers do modal rápido de manifestação + modal de encaminhamento. */
export function useManifestacaoListModals({ userId, refetchList, mutations }: UseManifestacaoListModalsParams) {
  const {
    updateStatus, verificarCompetencia,
    addTramitacao, addResposta, addDespacho, addPrazo, updatePrazoStatus,
  } = mutations;

  // ── Modal rápido ─────────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<ManifestacaoSummary | null>(null);
  const [modalTab, setModalTab] = useState("demanda");

  // Workflow form state
  const [tramObs, setTramObs] = useState("");
  const [tramTipo, setTramTipo] = useState<Tramitacao['tipoTramitacao']>('encaminhamento');
  const [respTexto, setRespTexto] = useState("");
  const [despTexto, setDespTexto] = useState("");
  const [prazoData, setPrazoData] = useState("");
  const [prazoTipo, setPrazoTipo] = useState("resposta");

  // Workflow data for selected manifestação
  const selectedId = selected?.id ?? null;
  const { data: tramitacoes, refetch: refetchTram } = useManifestacaoTramitacoes(selectedId);
  const { data: respostas, refetch: refetchResp } = useManifestacaoRespostas(selectedId);
  const { data: despachos, refetch: refetchDesp } = useManifestacaoDespachos(selectedId);
  const { data: prazos, refetch: refetchPrazos } = useManifestacaoPrazos(selectedId);
  const { data: cobranças } = useManifestacaoCobranças(selectedId);

  // ── Encaminhar para outra ouvidoria ─────────────────────────────────────────
  const [showEncaminhar, setShowEncaminhar] = useState(false);
  const [encaminharTarget, setEncaminharTarget] = useState<ManifestacaoSummary | null>(null);
  const [encaminharMotivo, setEncaminharMotivo] = useState("");
  const [encaminharOrgao, setEncaminharOrgao] = useState("Ouvidoria da Secretaria de Meio Ambiente (SEMA)");

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function openModal(m: ManifestacaoSummary) {
    setSelected(m);
    setModalTab("demanda");
    setTramObs(""); setRespTexto(""); setDespTexto(""); setPrazoData("");
  }

  function closeModal() {
    setSelected(null);
    setModalTab("demanda");
  }

  const handleAbrirEncaminhar = (m: ManifestacaoSummary, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEncaminharTarget(m);
    setEncaminharMotivo("");
    setShowEncaminhar(true);
  };

  const closeEncaminhar = () => {
    setShowEncaminhar(false);
    setEncaminharTarget(null);
  };

  const handleConfirmarEncaminhar = async () => {
    if (!encaminharTarget) return;
    if (!encaminharMotivo.trim()) { toast.error("Informe o motivo do encaminhamento"); return; }
    try {
      await updateStatus(encaminharTarget.id, 'encaminhado_sema');
      await verificarCompetencia(encaminharTarget.id, 'nao_compete', encaminharMotivo, encaminharOrgao);
      await addTramitacao({
        id: uuidv7(),
        manifestacaoId: encaminharTarget.id,
        deSetorId: encaminharTarget.setorId ?? null,
        paraSetorId: encaminharTarget.setorId ?? '',
        observacao: `Encaminhado para ${encaminharOrgao}. Motivo: ${encaminharMotivo}`,
        usuarioId: userId!,
        tipoTramitacao: 'transferencia',
        criadoEm: new Date().toISOString(),
      } satisfies Tramitacao);
      toast.success("Manifestação encaminhada para outra ouvidoria");
      setShowEncaminhar(false);
      setEncaminharTarget(null);
      if (selected?.id === encaminharTarget.id) closeModal();
      refetchList();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao encaminhar"); }
  };

  const handleAddTramitacao = async () => {
    if (!tramObs.trim() || !selectedId) return;
    try {
      await addTramitacao({
        id: uuidv7(),
        manifestacaoId: selectedId,
        deSetorId: selected!.setorId ?? null,
        paraSetorId: selected!.setorId ?? '',
        observacao: tramObs,
        usuarioId: userId!,
        tipoTramitacao: tramTipo,
        criadoEm: new Date().toISOString(),
      } satisfies Tramitacao);
      toast.success("Tramitação registrada");
      setTramObs("");
      refetchTram();
      refetchList();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao registrar tramitação"); }
  };

  const handleAddResposta = async () => {
    if (!respTexto.trim() || !selectedId) return;
    try {
      await addResposta({
        id: uuidv7(),
        manifestacaoId: selectedId,
        texto: respTexto,
        enviadaPorId: userId!,
        enviadaEm: new Date().toISOString(),
      } satisfies Resposta);
      toast.success("Resposta registrada");
      setRespTexto("");
      refetchResp();
      refetchList();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao registrar resposta"); }
  };

  const handleAddDespacho = async () => {
    if (!despTexto.trim() || !selectedId) return;
    try {
      await addDespacho({
        id: uuidv7(),
        manifestacaoId: selectedId,
        texto: despTexto,
        despachadoPorId: userId!,
        despachadoEm: new Date().toISOString(),
      } satisfies Despacho);
      toast.success("Despacho registrado");
      setDespTexto("");
      refetchDesp();
      refetchList();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao registrar despacho"); }
  };

  const handleAddPrazo = async () => {
    if (!prazoData || !selectedId) return;
    try {
      await addPrazo({
        id: uuidv7(),
        manifestacaoId: selectedId,
        tipoPrazo: prazoTipo,
        dataLimite: prazoData,
        status: "pendente",
        criadoEm: new Date().toISOString(),
      } as Prazo);
      toast.success("Prazo adicionado");
      setPrazoData("");
      refetchPrazos();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao adicionar prazo"); }
  };

  const handleMarcarPrazoCumprido = async (prazoId: string) => {
    try {
      await updatePrazoStatus(prazoId, 'cumprido', new Date().toISOString());
      toast.success("Prazo marcado como cumprido");
      refetchPrazos();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao atualizar prazo"); }
  };

  return {
    selected, modalTab, setModalTab, openModal, closeModal,
    tramObs, setTramObs, tramTipo, setTramTipo,
    respTexto, setRespTexto,
    despTexto, setDespTexto,
    prazoData, setPrazoData, prazoTipo, setPrazoTipo,
    tramitacoes, respostas, despachos, prazos, cobranças,
    showEncaminhar, encaminharTarget, encaminharMotivo, setEncaminharMotivo,
    encaminharOrgao, setEncaminharOrgao,
    handleAbrirEncaminhar, handleConfirmarEncaminhar, closeEncaminhar,
    handleAddTramitacao, handleAddResposta, handleAddDespacho, handleAddPrazo, handleMarcarPrazoCumprido,
  };
}
