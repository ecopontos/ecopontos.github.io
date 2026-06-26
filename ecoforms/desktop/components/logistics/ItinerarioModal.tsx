"use client";

import { useState, useMemo } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Search, X, Users, MapIcon, Wand2, Route, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { uuidv7 } from "ecoforms-core";
import { useClientes } from "@/src/interface/hooks/catalog/clientes";
import { useClientesByRoteiro, useLogisticsMutations } from "@/src/interface/hooks/catalog/logistica";
import { useClientesGeo, useItinerario, useTerrenos } from "@/src/interface/hooks/queries/useMapData";
import type { RoteiroCliente } from "@/src/domain/logistics/LogisticsRepository";
import type { Cliente } from "@/types/clientes";
import ItinerarioMap from "./ItinerarioMap";
import { nearestNeighborOrder, countSemLocalizacao, totalRouteKm, type GeoStop } from "@/lib/itinerary";

const PAGE_SIZE = 50;

type SearchMode = "nome" | "cep" | "bairro";

function SortableItem({
  item,
  cliente,
  isSelected,
  onSelect,
  onRemove,
  saving,
}: {
  item: RoteiroCliente;
  cliente: Cliente | undefined;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  saving: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.clienteId,
  });

  const nome = cliente?.nome || item.clienteNome || item.clienteId;
  const logradouro = cliente?.endereco || "";
  const numero = cliente?.numero || "";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`grid grid-cols-[1.5rem_2rem_1fr_8.5rem_2.5rem_1.5rem] items-center gap-1 px-2 py-1.5 rounded border bg-background select-none text-sm cursor-pointer ${
        isDragging ? "opacity-50 shadow-lg z-50" : ""
      } ${isSelected ? "border-primary bg-primary/5" : "hover:bg-accent"}`}
      onClick={onSelect}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <span className="text-xs font-bold text-muted-foreground text-right">{item.ordem}</span>
      <span className="truncate font-medium" title={nome}>{nome}</span>
      <span className="text-xs text-muted-foreground truncate" title={logradouro}>{logradouro || "—"}</span>
      <span className="text-xs text-muted-foreground text-right">{numero || "—"}</span>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 text-destructive hover:text-destructive"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        disabled={saving}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

interface Props {
  roteiroId: string;
  roteiroNome: string;
  open: boolean;
  onClose: () => void;
}

function formatEndereco(c: Cliente) {
  return [c.endereco, c.numero, c.bairro].filter(Boolean).join(", ") || "—";
}

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const lc = text.toLowerCase();
  const ql = query.toLowerCase();
  const idx = lc.indexOf(ql);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-foreground rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function ItinerarioModal({ roteiroId, roteiroNome, open, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [searchBy, setSearchBy] = useState<SearchMode>("nome");
  const [showMap, setShowMap] = useState(true);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data: clientesRoteiro, refetch } = useClientesByRoteiro(roteiroId);
  const clienteFilter = useMemo(() => {
    if (search.length < 2) return undefined;
    return { searchTerm: search };
  }, [search]);
  const { data: allClientes, loading: loadingClientes } = useClientes(clienteFilter);
  const { data: clientesGeo } = useClientesGeo();
  const { data: itinerario } = useItinerario(roteiroId);
  const { data: terrenos } = useTerrenos();
  const { addClienteToRoteiro, removeClienteFromRoteiro, updateClienteOrdemBatch, loading: saving } =
    useLogisticsMutations();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const clientMap = useMemo(() => {
    const map = new Map<string, Cliente>();
    for (const c of allClientes || []) {
      map.set(c.id, c);
    }
    return map;
  }, [allClientes]);

  const sorted = useMemo(
    () => [...(clientesRoteiro || [])].sort((a, b) => a.ordem - b.ordem),
    [clientesRoteiro],
  );

  const existingIds = useMemo(() => new Set(sorted.map((c) => c.clienteId)), [sorted]);

  const filteredAvailable = useMemo(() => {
    const base = (allClientes || []).filter((c) => !existingIds.has(c.id) && c.ativo === 1);
    if (search.length < 2) return base;
    const q = search.toLowerCase();
    if (searchBy === "cep") {
      return base.filter((c) => (c.cep || "").toLowerCase().includes(q));
    }
    if (searchBy === "bairro") {
      return base.filter((c) => (c.bairro || "").toLowerCase().includes(q));
    }
    return base.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.cep || "").toLowerCase().includes(q) ||
        (c.bairro || "").toLowerCase().includes(q) ||
        (c.endereco || "").toLowerCase().includes(q),
    );
  }, [allClientes, existingIds, search, searchBy]);

  const available = useMemo(
    () => filteredAvailable.slice(0, visibleCount),
    [filteredAvailable, visibleCount],
  );

  const totalAvailable = filteredAvailable.length;
  const hasMore = visibleCount < totalAvailable;

  const handleAdd = async (cliente: Cliente) => {
    const maxOrdem = sorted.length > 0 ? Math.max(...sorted.map((c) => c.ordem)) : 0;
    try {
      await addClienteToRoteiro({
        id: uuidv7(),
        roteiroId,
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        ordem: maxOrdem + 1,
        ativo: 1,
        criadoEm: new Date().toISOString(),
      } as RoteiroCliente);
      toast.success(`${cliente.nome} adicionado`);
      refetch();
    } catch {
      toast.error("Erro ao adicionar cliente");
    }
  };

  const handleRemove = async (clienteId: string) => {
    try {
      await removeClienteFromRoteiro(roteiroId, clienteId);
      toast.success("Removido do itinerário");
      refetch();
      if (selectedClienteId === clienteId) setSelectedClienteId(null);
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sorted.findIndex((c) => c.clienteId === active.id);
    const newIndex = sorted.findIndex((c) => c.clienteId === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sorted, oldIndex, newIndex).map((c, i) => ({
      ...c,
      ordem: i + 1,
    }));

    const changed = reordered.filter((c, i) => c.ordem !== sorted[i]?.ordem);
    if (changed.length === 0) return;
    try {
      await updateClienteOrdemBatch(
        roteiroId,
        changed.map((c) => ({ clienteId: c.clienteId, ordem: c.ordem })),
      );
      refetch();
    } catch {
      toast.error("Erro ao reordenar");
    }
  };

  // Stops do roteiro com coordenadas (join clienteId → geocódigo do itinerário).
  const geoStops: GeoStop[] = useMemo(() => {
    const coordById = new Map(
      (itinerario || []).map((s) => [s.cliente_id, { lat: s.latitude, lng: s.longitude }]),
    );
    return sorted.map((c) => ({
      id: c.clienteId,
      lat: coordById.get(c.clienteId)?.lat ?? null,
      lng: coordById.get(c.clienteId)?.lng ?? null,
    }));
  }, [sorted, itinerario]);

  const semLoc = countSemLocalizacao(geoStops);
  const totalKm = totalRouteKm(geoStops);

  const handleOptimize = async () => {
    if (geoStops.filter((s) => s.lat != null && s.lng != null).length < 3) {
      toast.error("Pontos com localização insuficientes para otimizar.");
      return;
    }
    const orderedIds = nearestNeighborOrder(geoStops);
    const changes = orderedIds
      .map((cid, i) => ({ clienteId: cid, ordem: i + 1 }))
      .filter((c) => sorted.find((s) => s.clienteId === c.clienteId)?.ordem !== c.ordem);
    if (changes.length === 0) {
      toast.info("Rota já está otimizada.");
      return;
    }
    try {
      await updateClienteOrdemBatch(roteiroId, changes);
      toast.success("Rota otimizada por proximidade");
      refetch();
    } catch {
      toast.error("Erro ao otimizar rota");
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setVisibleCount(PAGE_SIZE);
  };

  const searchModes: { value: SearchMode; label: string }[] = [
    { value: "nome", label: "Nome" },
    { value: "cep", label: "CEP" },
    { value: "bairro", label: "Bairro" },
  ];

  const searchPlaceholder =
    searchBy === "cep"
      ? "Buscar por CEP..."
      : searchBy === "bairro"
        ? "Buscar por bairro..."
        : "Buscar por nome, CEP ou bairro...";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-6xl flex flex-col gap-3 p-0 h-[min(700px,85vh)]">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Itinerário — {roteiroNome}
            </span>
            <Button
              variant={showMap ? "default" : "outline"}
              size="sm"
              className="ml-4"
              onClick={() => setShowMap(!showMap)}
            >
              <MapIcon className="h-4 w-4 mr-1.5" />
              {showMap ? "Ocultar mapa" : "Ver mapa"}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-0 flex-1 min-h-0 overflow-hidden">
          {/* Left panel: available clients */}
          <div className={`flex flex-col gap-1.5 min-h-0 p-4 pt-2 ${showMap ? "w-[38%]" : "w-1/2"}`}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Clientes disponíveis
            </p>
            <div className="flex gap-1.5">
              {searchModes.map((mode) => (
                <button
                  key={mode.value}
                  className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                    searchBy === mode.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground border-border"
                  }`}
                  onClick={() => {
                    setSearchBy(mode.value);
                    handleSearchChange("");
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                className="pl-8 pr-8"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              {search && (
                <button
                  className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                  onClick={() => handleSearchChange("")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between px-3">
              <div className="grid grid-cols-[1fr_2.5rem_8.5rem] gap-1 flex-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span>Nome</span>
                <span className="text-center">Tipo</span>
                <span>Endereço</span>
              </div>
              {totalAvailable > 0 && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                  {available.length} de {totalAvailable}
                </span>
              )}
            </div>
            <ScrollArea className="flex-1 rounded-md border">
              <div className="p-1 space-y-0.5">
                {loadingClientes ? (
                  <p className="p-3 text-sm text-muted-foreground">Carregando...</p>
                ) : available.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    {search.length < 2
                      ? "Digite ao menos 2 caracteres para buscar."
                      : "Nenhum cliente encontrado."}
                  </p>
                ) : (
                  <>
                    {available.map((c) => (
                      <button
                        key={c.id}
                        className={`grid grid-cols-[1fr_2.5rem_8.5rem] gap-1 items-center w-full text-left px-3 py-1.5 text-sm rounded group ${
                          selectedClienteId === c.id ? "bg-primary/10 border border-primary" : "hover:bg-accent"
                        }`}
                        onClick={() => setSelectedClienteId(c.id)}
                        onDoubleClick={() => handleAdd(c)}
                        disabled={saving}
                      >
                        <span className="truncate font-medium">
                          {highlightMatch(c.nome, search.length >= 2 ? search : "")}
                        </span>
                        <span className="text-xs text-muted-foreground text-center shrink-0">
                          <span className="inline-flex items-center gap-0.5">
                            <span className="bg-muted rounded px-1 py-px text-[10px] leading-tight">{c.tipo}</span>
                          </span>
                        </span>
                        <span className="text-xs text-muted-foreground truncate" title={formatEndereco(c)}>
                          {formatEndereco(c)}
                        </span>
                      </button>
                    ))}
                    {hasMore && (
                      <button
                        className="w-full py-2 text-xs text-primary hover:underline"
                        onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                      >
                        Carregar mais ({totalAvailable - visibleCount} restantes)
                      </button>
                    )}
                  </>
                )}
              </div>
            </ScrollArea>
            <p className="text-[10px] text-muted-foreground">Clique duplo para adicionar ao itinerário</p>
          </div>

          {/* Right panel: collection points */}
          <div className={`flex flex-col gap-1.5 min-h-0 p-4 pt-2 border-l border-border ${showMap ? "w-[30%]" : "w-1/2"}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Pontos de coleta{sorted.length > 0 ? ` (${sorted.length})` : ""}
              </p>
              {sorted.length >= 3 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs gap-1"
                  onClick={handleOptimize}
                  disabled={saving}
                  title="Reordenar por proximidade (vizinho mais próximo)"
                >
                  <Wand2 className="h-3 w-3" />
                  Otimizar
                </Button>
              )}
            </div>
            {(totalKm > 0 || semLoc > 0) && (
              <div className="flex items-center gap-3 text-[10px] flex-wrap">
                {totalKm > 0 && (
                  <span className="text-muted-foreground inline-flex items-center gap-1">
                    <Route className="h-3 w-3" />{totalKm.toFixed(1)} km (linha reta)
                  </span>
                )}
                {semLoc > 0 && (
                  <span
                    className="text-amber-600 inline-flex items-center gap-1"
                    title="Pontos sem coordenada não aparecem no mapa nem entram na otimização"
                  >
                    <AlertTriangle className="h-3 w-3" />{semLoc} de {sorted.length} sem localização
                  </span>
                )}
              </div>
            )}
            <div className="grid grid-cols-[1.5rem_2rem_1fr_8.5rem_2.5rem_1.5rem] gap-1 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <span></span>
              <span className="text-right">Ord</span>
              <span>Nome</span>
              <span>Logradouro</span>
              <span className="text-right">Nº</span>
              <span></span>
            </div>
            <ScrollArea className="flex-1 rounded-md border">
              {sorted.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  Nenhum ponto adicionado. Selecione clientes ao lado.
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={sorted.map((c) => c.clienteId)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="p-1 space-y-0.5">
                      {sorted.map((c) => (
                        <SortableItem
                          key={c.clienteId}
                          item={c}
                          cliente={clientMap.get(c.clienteId)}
                          isSelected={selectedClienteId === c.clienteId}
                          onSelect={() => setSelectedClienteId(c.clienteId)}
                          onRemove={() => handleRemove(c.clienteId)}
                          saving={saving}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </ScrollArea>
          </div>

          {/* Map sidebar */}
          {showMap && (
            <div className="flex flex-col w-[32%] min-h-0 p-4 pt-2 border-l border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Mapa do itinerário
              </p>
              <div className="flex-1 rounded-md overflow-hidden border">
<ItinerarioMap
                  clientesGeo={clientesGeo || []}
                  itinerario={itinerario || []}
                  terrenosGeo={terrenos || []}
                  selectedClienteId={selectedClienteId}
                  onClienteClick={setSelectedClienteId}
                />
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-white" style={{ backgroundColor: "#ef4444" }} /> No roteiro</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full opacity-40" style={{ backgroundColor: "#22c55e" }} /> PF</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full opacity-40" style={{ backgroundColor: "#3b82f6" }} /> PJ</span>
                <span className="flex items-center gap-1"><span className="inline-block w-5 border-t-2 border-dashed" style={{ borderColor: "#ef4444" }} /> Rota</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 border border-red-500 opacity-60" style={{ backgroundColor: "#ef4444", opacity: 0.3 }} /> Terreno</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
