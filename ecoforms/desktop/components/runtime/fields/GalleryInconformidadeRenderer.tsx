"use client";

import { useMemo, useState } from "react";
import { FormField } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Camera, Pencil, X } from "lucide-react";
import { cn } from "@/src/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { useDataRegistryAggregated } from "@/src/interface/hooks/catalog/data-registry";
import { getRegistrySource, normalizeSelectionOptions } from "./option-utils";
import {
    type GalleryInconformidadeEntry,
    type QueuedPhoto,
    makeLocalId,
    buildEntriesFromQueue,
    applyQueueSave,
} from "@/src/lib/gallery-inconformidade";

interface GalleryInconformidadeRendererProps {
    field: FormField;
    value: GalleryInconformidadeEntry[];
    onChange: (value: GalleryInconformidadeEntry[]) => void;
    readOnly?: boolean;
}

function getConfigNumber(field: FormField, key: string, fallback: number): number {
    const cfg = field.config;
    if (cfg && typeof cfg === "object" && typeof (cfg as Record<string, unknown>)[key] === "number") {
        return (cfg as Record<string, unknown>)[key] as number;
    }
    return fallback;
}

export function GalleryInconformidadeRenderer({ field, value = [], onChange, readOnly = false }: GalleryInconformidadeRendererProps) {
    const maxFiles = getConfigNumber(field, "maxFiles", 20);
    const maxFileSizeKb = getConfigNumber(field, "maxFileSizeKb", 5000);

    const [modalOpen, setModalOpen] = useState(false);
    const [queue, setQueue] = useState<QueuedPhoto[]>([]);
    const [selectedInconformidades, setSelectedInconformidades] = useState<string[]>([]);
    const [observacao, setObservacao] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);

    const { data: fetchedData } = useDataRegistryAggregated(getRegistrySource(field));

    const options = useMemo(() => {
        const normalized = normalizeSelectionOptions(fetchedData);
        return normalized.filter((opt) => (opt as Record<string, unknown>).ativo !== false);
    }, [fetchedData]);

    const openModal = () => {
        setQueue([]);
        setSelectedInconformidades([]);
        setObservacao("");
        setEditingId(null);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setQueue([]);
        setSelectedInconformidades([]);
        setObservacao("");
        setEditingId(null);
    };

    const addFileToQueue = (file: File) => {
        if (file.size / 1024 > maxFileSizeKb) {
            alert(`Foto excede o tamanho máximo permitido de ${maxFileSizeKb}KB.`);
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setQueue((prev) => [...prev, { localId: makeLocalId(), imagemBase64: reader.result as string }]);
        };
        reader.readAsDataURL(file);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        files.forEach(addFileToQueue);
        e.target.value = "";
    };

    const removeFromQueue = (id: string) => {
        setQueue((prev) => prev.filter((f) => f.localId !== id));
    };

    const toggleInconformidade = (id: string) => {
        setSelectedInconformidades((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
        );
    };

    const handleSave = () => {
        if (queue.length === 0) {
            alert("Adicione ao menos uma foto antes de salvar.");
            return;
        }
        const currentCount = editingId ? value.length - 1 : value.length;
        if (currentCount + queue.length > maxFiles) {
            alert(`Limite de ${maxFiles} fotos atingido para este campo.`);
            return;
        }
        const entries = buildEntriesFromQueue(queue, selectedInconformidades, observacao);
        onChange(applyQueueSave(value, editingId, entries));
        closeModal();
    };

    const editEntry = (idFoto: string) => {
        const entry = value.find((e) => e.id_foto === idFoto);
        if (!entry) return;
        setEditingId(idFoto);
        setQueue([{ localId: makeLocalId(), imagemBase64: entry.imagem }]);
        setSelectedInconformidades([...entry.inconformidades]);
        setObservacao(entry.observacao || "");
        setModalOpen(true);
    };

    const removeEntry = (idFoto: string) => {
        if (!confirm("Remover esta evidência fotográfica?")) return;
        onChange(value.filter((e) => e.id_foto !== idFoto));
    };

    const canAddMore = value.length < maxFiles;

    return (
        <div className="space-y-3">
            <Label>
                {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>

            {value.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground bg-muted/20 rounded border border-dashed">
                    Nenhuma evidência registrada ainda.
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {value.map((entry) => (
                        <div key={entry.id_foto} className="relative group border rounded-md overflow-hidden bg-slate-50">
                            <img src={entry.imagem} alt="Evidência" className="w-full h-24 object-cover" />
                            <div className="p-2 space-y-1">
                                <div className={cn("text-xs font-semibold", entry.inconformidades.length > 0 ? "text-red-600" : "text-green-600")}>
                                    {entry.inconformidades.length > 0
                                        ? `⚠️ ${entry.inconformidades.length} inconformidade(s)`
                                        : "✅ Sem apontamento"}
                                </div>
                            </div>
                            {!readOnly && (
                                <div className="absolute top-2 right-2 flex gap-1">
                                    <Button type="button" variant="secondary" size="icon" className="h-6 w-6" onClick={() => editEntry(entry.id_foto)}>
                                        <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button type="button" variant="destructive" size="icon" className="h-6 w-6" onClick={() => removeEntry(entry.id_foto)}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {!readOnly && (
                <Button type="button" variant="secondary" disabled={!canAddMore} onClick={openModal}>
                    <Camera className="mr-2 h-4 w-4" />
                    Adicionar Registro Fotográfico ({value.length}/{maxFiles})
                </Button>
            )}

            <Dialog open={modalOpen} onOpenChange={(open) => !open && closeModal()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nova Evidência Fotográfica</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {queue.length === 0 ? (
                            <div className="p-3 text-center text-xs text-muted-foreground bg-muted/20 rounded border border-dashed">
                                Nenhuma foto na fila. Selecione um ou mais arquivos.
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {queue.map((foto) => (
                                    <div key={foto.localId} className="relative w-20 h-20">
                                        <img src={foto.imagemBase64} alt="Foto pendente" className="w-full h-full object-cover rounded-lg border" />
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                            onClick={() => removeFromQueue(foto.localId)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <Button variant="secondary" className="relative cursor-pointer" type="button">
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                            />
                            <Camera className="mr-2 h-4 w-4" />
                            Selecionar Foto(s)
                        </Button>

                        <div className="space-y-2">
                            <Label className="text-xs">Inconformidades Detectadas</Label>
                            <div className="flex flex-wrap gap-2">
                                {options.map((option) => {
                                    const isSelected = selectedInconformidades.includes(option.value);
                                    return (
                                        <Badge
                                            key={option.value}
                                            variant={isSelected ? "default" : "outline"}
                                            className="cursor-pointer select-none"
                                            onClick={() => toggleInconformidade(option.value)}
                                        >
                                            {option.label}
                                        </Badge>
                                    );
                                })}
                                {options.length === 0 && (
                                    <span className="text-xs text-muted-foreground italic">Nenhuma inconformidade cadastrada no catálogo.</span>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">Observação (opcional)</Label>
                            <Textarea
                                value={observacao}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setObservacao(e.target.value)}
                                placeholder="Detalhes adicionais..."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
                        <Button type="button" onClick={handleSave}>Salvar ({queue.length})</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
