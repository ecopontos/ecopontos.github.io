"use client";

import { useState, useMemo } from "react";
import { MessageSquareWarning, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  useManifestacoes,
  useManifestacaoMutations,
} from "@/src/interface/hooks/catalog/manifestacoes";
import { useSetores } from "@/src/interface/hooks/catalog/auth";
import { useAuth } from "@/src/interface/hooks/catalog/auth";
import type { ManifestacaoSummary } from "@/src/domain/ouvidoria/ManifestacaoRepository";
import { isManifestacaoTerminal } from "@/src/domain/ouvidoria/ManifestacaoWorkflowPolicy";
import { MANIFESTACAO_LIST_TABS } from "@/src/interface/workflow/ManifestacaoWorkflowConfig";
import { urgencyScore, type QuickFilter } from "./_lib/helpers";
import { KpiStrip } from "./_components/KpiStrip";
import { WorkQueueTable } from "./_components/WorkQueueTable";
import { ActivityFeed } from "./_components/ActivityFeed";
import { ManifestacaoQuickModal } from "./_components/ManifestacaoQuickModal";
import { EncaminharModal } from "./_components/EncaminharModal";
import { useManifestacaoListModals } from "./_hooks/useManifestacaoListModals";

export default function ManifestacoesPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Server-side filters
  const [search, setSearch] = useState("");
  const [setorFilter, setSetorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Client-side quick filter
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('todos');

  const { data: manifestacoes, loading, refetch } = useManifestacoes({
    searchTerm: search || undefined,
    setorId: setorFilter || undefined,
    status: statusFilter || undefined,
  });
  const { data: setores } = useSetores();
  const mutations = useManifestacaoMutations();
  const { loading: saving } = mutations;

  const modals = useManifestacaoListModals({
    userId: user?.id,
    refetchList: refetch,
    mutations,
  });

  const podeEncaminhar = user?.perfil === 'admin' || user?.perfil === 'gerente' || user?.perfil === 'coordenador';

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const h48 = now.getTime() + 48 * 3_600_000;
    return {
      vencidas:    manifestacoes.filter(m => !isManifestacaoTerminal(m.status) && m.prazoLimite && new Date(m.prazoLimite) < now).length,
      vencendo48h: manifestacoes.filter(m => !isManifestacaoTerminal(m.status) && m.prazoLimite && new Date(m.prazoLimite) >= now && new Date(m.prazoLimite).getTime() <= h48).length,
      aguardando:  manifestacoes.filter(m => ['aberta','em_analise','em_atendimento','devolvida'].includes(m.status)).length,
      novasHoje:   manifestacoes.filter(m => new Date(m.criadoEm) >= todayStart).length,
      devolvidas:  manifestacoes.filter(MANIFESTACAO_LIST_TABS.devolvidas).length,
    };
  }, [manifestacoes]);

  // ── Work queue ───────────────────────────────────────────────────────────────
  const fila = useMemo(() => {
    const now = new Date();
    const h48 = now.getTime() + 48 * 3_600_000;
    let items = [...manifestacoes];
    switch (quickFilter) {
      case 'minha_fila':       items = items.filter(m => m.responsavelId === user?.id); break;
      case 'aguardando_aceite':items = items.filter(MANIFESTACAO_LIST_TABS.aguardando_aceite); break;
      case 'devolvidas':       items = items.filter(MANIFESTACAO_LIST_TABS.devolvidas); break;
      case 'vencendo':         items = items.filter(m => !isManifestacaoTerminal(m.status) && m.prazoLimite && new Date(m.prazoLimite) >= now && new Date(m.prazoLimite).getTime() <= h48); break;
      case 'novas':            items = items.filter(MANIFESTACAO_LIST_TABS.novas); break;
    }
    return items.sort((a, b) => {
      const sa = urgencyScore(a), sb = urgencyScore(b);
      if (sa !== sb) return sa - sb;
      if (a.prazoLimite && b.prazoLimite) return new Date(a.prazoLimite).getTime() - new Date(b.prazoLimite).getTime();
      if (a.prazoLimite) return -1;
      if (b.prazoLimite) return 1;
      return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
    });
  }, [manifestacoes, quickFilter, user?.id]);

  // ── Activity feed ────────────────────────────────────────────────────────────
  const feed = useMemo(() =>
    [...manifestacoes]
      .filter(m => m.atualizadoEm)
      .sort((a, b) => new Date(b.atualizadoEm!).getTime() - new Date(a.atualizadoEm!).getTime())
      .slice(0, 15),
    [manifestacoes]
  );

  const QUICK_TABS: { key: QuickFilter; label: string; count: number }[] = [
    { key: 'todos',             label: 'Todas',             count: manifestacoes.length },
    { key: 'minha_fila',        label: 'Minha fila',        count: manifestacoes.filter(m => m.responsavelId === user?.id).length },
    { key: 'aguardando_aceite', label: 'Aguardando aceite', count: manifestacoes.filter(MANIFESTACAO_LIST_TABS.aguardando_aceite).length },
    { key: 'devolvidas',        label: 'Devolvidas',        count: kpis.devolvidas },
    { key: 'vencendo',          label: 'Vencendo',          count: kpis.vencendo48h },
    { key: 'novas',             label: 'Novas',             count: kpis.novasHoje },
  ];

  const openDetail = (id: string) => router.push(`/manifestacoes/${id}`);

  const handleSelectKpiFilter = (filter: QuickFilter) => {
    setStatusFilter("");
    setQuickFilter(filter);
  };

  const handleAbrirEncaminhar = (m: ManifestacaoSummary, e?: React.MouseEvent) => modals.handleAbrirEncaminhar(m, e);

  return (
    <div className="container mx-auto py-6 px-4 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MessageSquareWarning className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Manifestações</h1>
            <p className="text-sm text-muted-foreground">Ouvidoria — painel de atendimento</p>
          </div>
        </div>
        <Link href="/manifestacoes/novo">
          <Button><Plus className="h-4 w-4 mr-1" />Nova manifestação</Button>
        </Link>
      </div>

      <KpiStrip kpis={kpis} onSelectFilter={handleSelectKpiFilter} />

      {/* Split layout */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4 items-start">

        <WorkQueueTable
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          setorFilter={setorFilter}
          onSetorFilterChange={setSetorFilter}
          setores={setores}
          quickFilter={quickFilter}
          onQuickFilterChange={setQuickFilter}
          quickTabs={QUICK_TABS}
          loading={loading}
          fila={fila}
          podeEncaminhar={podeEncaminhar}
          onOpenModal={modals.openModal}
          onAbrirEncaminhar={handleAbrirEncaminhar}
          onOpenDetail={openDetail}
        />

        <ActivityFeed feed={feed} onOpenModal={modals.openModal} />
      </div>

      <ManifestacaoQuickModal
        selected={modals.selected}
        modalTab={modals.modalTab}
        onModalTabChange={modals.setModalTab}
        onClose={modals.closeModal}
        onOpenDetail={openDetail}
        podeEncaminhar={podeEncaminhar}
        onAbrirEncaminhar={handleAbrirEncaminhar}
        saving={saving}
        tramitacoes={modals.tramitacoes}
        respostas={modals.respostas}
        despachos={modals.despachos}
        prazos={modals.prazos}
        cobranças={modals.cobranças}
        tramObs={modals.tramObs}
        onTramObsChange={modals.setTramObs}
        tramTipo={modals.tramTipo}
        onTramTipoChange={modals.setTramTipo}
        onAddTramitacao={modals.handleAddTramitacao}
        respTexto={modals.respTexto}
        onRespTextoChange={modals.setRespTexto}
        onAddResposta={modals.handleAddResposta}
        despTexto={modals.despTexto}
        onDespTextoChange={modals.setDespTexto}
        onAddDespacho={modals.handleAddDespacho}
        prazoData={modals.prazoData}
        onPrazoDataChange={modals.setPrazoData}
        prazoTipo={modals.prazoTipo}
        onPrazoTipoChange={modals.setPrazoTipo}
        onAddPrazo={modals.handleAddPrazo}
        onMarcarCumprido={modals.handleMarcarPrazoCumprido}
      />

      <EncaminharModal
        open={modals.showEncaminhar}
        target={modals.encaminharTarget}
        motivo={modals.encaminharMotivo}
        onMotivoChange={modals.setEncaminharMotivo}
        orgao={modals.encaminharOrgao}
        onOrgaoChange={modals.setEncaminharOrgao}
        onClose={modals.closeEncaminhar}
        onConfirm={modals.handleConfirmarEncaminhar}
        saving={saving}
      />
    </div>
  );
}
