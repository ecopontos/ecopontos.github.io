/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo } from "react";
import { Search, Send, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ManifestacaoSummary } from "@/src/domain/ouvidoria/ManifestacaoRepository";
import { isManifestacaoTerminal } from "@/src/domain/ouvidoria/ManifestacaoWorkflowPolicy";
import {
  STATUS_LABEL, statusVariant, urgencyScore, rowBorder, UrgencyDot, PrazoBadge,
  type QuickFilter,
} from "../_lib/helpers";

const PAGE_SIZE = 50;

interface QuickTab {
  key: QuickFilter;
  label: string;
  count: number;
}

interface WorkQueueTableProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  setorFilter: string;
  onSetorFilterChange: (value: string) => void;
  setores: { id: string; nome: string }[];
  quickFilter: QuickFilter;
  onQuickFilterChange: (filter: QuickFilter) => void;
  quickTabs: QuickTab[];
  loading: boolean;
  fila: ManifestacaoSummary[];
  podeEncaminhar: boolean;
  onOpenModal: (m: ManifestacaoSummary) => void;
  onAbrirEncaminhar: (m: ManifestacaoSummary, e?: React.MouseEvent) => void;
  onOpenDetail: (id: string) => void;
}

/** Coluna "Fila de Trabalho": filtros rápidos, busca e tabela de manifestações. */
export function WorkQueueTable({
  search, onSearchChange,
  statusFilter, onStatusFilterChange,
  setorFilter, onSetorFilterChange, setores,
  quickFilter, onQuickFilterChange, quickTabs,
  loading, fila, podeEncaminhar,
  onOpenModal, onAbrirEncaminhar, onOpenDetail,
}: WorkQueueTableProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [fila.length, quickFilter, statusFilter, setorFilter, search]);

  const visible = useMemo(() => fila.slice(0, visibleCount), [fila, visibleCount]);

  return (
    <div className="space-y-3">
      {/* Quick filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {quickTabs.map(tab => (
          <Button
            key={tab.key}
            size="sm"
            variant={quickFilter === tab.key ? 'default' : 'outline'}
            onClick={() => onQuickFilterChange(tab.key)}
            className="h-7 text-xs"
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 text-xs leading-4 ${quickFilter === tab.key ? 'bg-white/25' : 'bg-muted text-muted-foreground'}`}>
                {tab.count}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Server filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Protocolo, assunto, solicitante..."
            className="pl-8"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <select value={statusFilter} onChange={e => onStatusFilterChange(e.target.value)} className="border rounded-md px-3 py-2 bg-background text-sm">
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={setorFilter} onChange={e => onSetorFilterChange(e.target.value)} className="border rounded-md px-3 py-2 bg-background text-sm">
          <option value="">Todos os setores</option>
          {setores.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </div>

      {/* Work queue table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-muted-foreground p-6">Carregando...</p>
          ) : fila.length === 0 ? (
            <p className="text-muted-foreground p-8 text-center text-sm">Nenhuma manifestação neste filtro.</p>
          ) : (
            <div className="rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="w-6 pl-4"></TableHead>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Assunto / Solicitante</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map(m => {
                    const score = urgencyScore(m);
                    return (
                      <TableRow
                        key={m.id}
                        className={`cursor-pointer transition-colors ${rowBorder(score)} hover:brightness-95`}
                        onClick={() => onOpenModal(m)}
                      >
                        <TableCell className="pl-4 pr-0"><UrgencyDot score={score} /></TableCell>
                        <TableCell className="font-mono text-xs font-semibold whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <Link href={`/manifestacoes/detalhe?id=${m.id}`} className="hover:underline">{m.protocolo}</Link>
                        </TableCell>
                        <TableCell className="max-w-[180px]">
                          <p className="truncate text-sm font-medium">{m.assunto}</p>
                          <p className="truncate text-xs text-muted-foreground">{m.anonimo ? "Anônimo" : (m.solicitanteNome || "—")}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(m.status)} className="text-xs whitespace-nowrap">
                            {STATUS_LABEL[m.status] ?? m.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={m.prioridade === 'critico' ? 'destructive' : m.prioridade === 'urgente' ? 'secondary' : 'outline'} className="text-xs">
                            {m.prioridade}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap"><PrazoBadge m={m} /></TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">{m.setorNome || "—"}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()} className="pr-2">
                          <div className="flex gap-1 justify-end">
                            {podeEncaminhar && !isManifestacaoTerminal(m.status) && (
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-orange-500 hover:text-orange-600 hover:bg-orange-50" title="Encaminhar" onClick={e => onAbrirEncaminhar(m, e)}>
                                <Send className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Abrir detalhes" onClick={e => { e.stopPropagation(); onOpenDetail(m.id); }}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {visibleCount < fila.length && (
                <div className="p-3 text-center border-t">
                  <Button size="sm" variant="outline" onClick={() => setVisibleCount(c => c + PAGE_SIZE)}>
                    Carregar mais ({visibleCount} de {fila.length})
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 text-xs text-muted-foreground px-1">
        <span>{visibleCount < fila.length ? `${visibleCount} de ${fila.length}` : `${fila.length}`} manifestação(ões)</span>
        <span>·</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" />vencida</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-orange-400" />urgente</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />atenção</span>
      </div>
    </div>
  );
}
