"use client";
/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useMemo } from "react";
import { FormField } from "@/types";
import { ChevronDown, ChevronUp, Check, X, Camera, AlertCircle, ImageIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/src/lib/utils";
import { useDataRegistryAggregated } from "@/src/interface/hooks/catalog/data-registry";
import { getRegistrySource } from "./option-utils";

interface VistoriaChecklistRendererProps {
    field: FormField;
    value: VistoriaChecklistValue | VistoriaChecklistItems | null | undefined;
    onChange: (value: VistoriaChecklistValue) => void;
    readOnly?: boolean;
}

interface ChecklistItem {
    id: string;
    descricao: string;
}

interface Subcategoria {
    id: string;
    nome: string;
    items: ChecklistItem[];
}

interface Categoria {
    id: string;
    nome: string;
    icone?: string;
    items?: ChecklistItem[]; // Direct items
    subcategorias?: Subcategoria[]; // Or subcategories
}

interface ItemState {
    status: 'conforme' | 'nao_conforme' | 'na' | null;
    obs: string;
    fotos: Array<{ uri: string; file?: File } | string>; // Support legacy strings and new objects
}

export type VistoriaChecklistItems = Record<string, ItemState>;

interface VistoriaDetalhe {
    categoria: string;
    item_id: string;
    descricao: string;
    status: ItemState['status'];
    observacao: string;
    tem_foto: boolean;
    qtd_fotos: number;
}

export interface VistoriaChecklistValue {
    items: VistoriaChecklistItems;
    detalhes: VistoriaDetalhe[];
    resumo: {
        total_itens: number;
        itens_vistoriados: number;
        nao_conformidades: number;
        percentual_completo: number;
    };
    timestamp: string;
}

function toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

function toStringValue(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function normalizeChecklistItem(value: unknown): ChecklistItem | null {
    const record = toRecord(value);
    if (!record) {
        return null;
    }

    const id = toStringValue(record.id);
    const descricao = toStringValue(record.descricao);

    if (!id || !descricao) {
        return null;
    }

    return { id, descricao };
}

function normalizeSubcategoria(value: unknown): Subcategoria | null {
    const record = toRecord(value);
    if (!record) {
        return null;
    }

    const id = toStringValue(record.id);
    const nome = toStringValue(record.nome);
    const items = Array.isArray(record.items)
        ? record.items.flatMap((item) => {
            const normalized = normalizeChecklistItem(item);
            return normalized ? [normalized] : [];
        })
        : [];

    if (!id || !nome) {
        return null;
    }

    return { id, nome, items };
}

function normalizeCategoria(value: unknown): Categoria | null {
    const record = toRecord(value);
    if (!record) {
        return null;
    }

    const id = toStringValue(record.id);
    const nome = toStringValue(record.nome);

    if (!id || !nome) {
        return null;
    }

    const items = Array.isArray(record.items)
        ? record.items.flatMap((item) => {
            const normalized = normalizeChecklistItem(item);
            return normalized ? [normalized] : [];
        })
        : undefined;
    const subcategorias = Array.isArray(record.subcategorias)
        ? record.subcategorias.flatMap((subcategoria) => {
            const normalized = normalizeSubcategoria(subcategoria);
            return normalized ? [normalized] : [];
        })
        : undefined;

    return {
        id,
        nome,
        icone: toStringValue(record.icone),
        items,
        subcategorias,
    };
}

function normalizeCategorias(value: unknown): Categoria[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.flatMap((categoria) => {
        const normalized = normalizeCategoria(categoria);
        return normalized ? [normalized] : [];
    });
}

function getBooleanConfigValue(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
}

function getNumberConfigValue(value: unknown, fallback: number): number {
    return typeof value === "number" ? value : fallback;
}

export function VistoriaChecklistRenderer({ field, value, onChange, readOnly = false }: VistoriaChecklistRendererProps) {
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

    // Fetch dynamic checklist definition if dataSource is present
    // Bug C: captura loading/error para feedback ao usuario.
    const { data: fetchedData, loading, error } = useDataRegistryAggregated(getRegistrySource(field));

    const config = field.config || {};
    const permitirFotos = getBooleanConfigValue(config.permitirFotos, true);
    const obrigatorioObservacaoNC = getBooleanConfigValue(config.obrigatorioObservacaoNC, true);
    const obrigatorioFotoNC = getBooleanConfigValue(config.obrigatorioFotoNC, true);
    const maxFotos = getNumberConfigValue(config.maxFotos, 5);

    // Use fetched categories if available, otherwise use defined options or legacy format
    const categorias: Categoria[] = useMemo(() => {
        if (fetchedData && fetchedData.length > 0) {
            const firstItem = fetchedData[0];
            const firstRecord = toRecord(firstItem);
            if (firstRecord && Array.isArray(firstRecord.categorias)) {
                return normalizeCategorias(firstRecord.categorias);
            }
            return normalizeCategorias(fetchedData);
        }
        // field.categorias is the canonical location (matches form schema)
        // field.items is legacy fallback
        return normalizeCategorias(field.categorias || field.items);
    }, [fetchedData, field.categorias, field.items]);

    // Value normalization: { items: { id: { status, obs, foto } } }
    const itemsValue: VistoriaChecklistItems = value && typeof value === 'object' && 'items' in value
        ? (value.items || {}) as VistoriaChecklistItems
        : (value || {}) as VistoriaChecklistItems;

    const handleToggleCategory = (catId: string) => {
        setExpandedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
    };

    const handleSetStatus = (itemId: string, status: 'conforme' | 'nao_conforme' | 'na') => {
        if (readOnly) return;
        const currentItem = itemsValue[itemId] || { status: null, obs: '', fotos: [] };

        // If changing to 'conforme', clear mandatory fields logic if desired,
        // but typically we keep photo/obs if user switch triggers by mistake,
        // unless strictly resetting. Legacy clears OBS but keeps PHOTO (optional).
        const newItem = {
            ...currentItem,
            status
        };

        if (status === 'conforme') {
            newItem.obs = ''; // Clear obs on OK
        }

        updateItem(itemId, newItem);
    };

    const handleSetObs = (itemId: string, obs: string) => {
        if (readOnly) return;
        const currentItem = itemsValue[itemId] || { status: null, obs: '', fotos: [] };
        updateItem(itemId, { ...currentItem, obs });
    };

    const handleCapturePhoto = (itemId: string, file: File) => {
        if (readOnly) return;
        const currentItem = itemsValue[itemId] || { status: null, obs: '', fotos: [] };

        if (currentItem.fotos.length >= maxFotos) {
            alert(`Máximo de ${maxFotos} fotos permitido por item.`);
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            const newPhoto = { uri: reader.result as string, file: file };
            const newFotos = [...currentItem.fotos, newPhoto];
            updateItem(itemId, { ...currentItem, fotos: newFotos });
        };
        reader.readAsDataURL(file);
    };

    const handleRemovePhoto = (itemId: string, index: number) => {
        if (readOnly) return;
        const currentItem = itemsValue[itemId] || { status: null, obs: '', fotos: [] };
        const newFotos = currentItem.fotos.filter((_, i: number) => i !== index);
        updateItem(itemId, { ...currentItem, fotos: newFotos });
    };

    const updateItem = (itemId: string, partialValue: ItemState) => {
        const nextItems = { ...itemsValue, [itemId]: partialValue };

        // Calculate stats
        const stats = calculateStats(nextItems);

        // Generate details array (flattened)
        const detalhes = generateDetalhes(nextItems);

        onChange({
            items: nextItems,
            detalhes: detalhes,
            resumo: {
                total_itens: stats.totalItems,
                itens_vistoriados: stats.preenchidos,
                nao_conformidades: stats.naoConformes,
                percentual_completo: stats.totalItems > 0 ? Math.round((stats.preenchidos / stats.totalItems) * 100) : 0
            },
            timestamp: new Date().toISOString()
        });
    };

    const generateDetalhes = (currentItemsValue: VistoriaChecklistItems): VistoriaDetalhe[] => {
        const detalhes: VistoriaDetalhe[] = [];

        categorias.forEach(cat => {
            const processItems = (list: ChecklistItem[], catName: string) => {
                list.forEach(item => {
                    const data = currentItemsValue[item.id] || { status: null, obs: '', fotos: [] };
                    detalhes.push({
                        categoria: catName,
                        item_id: item.id,
                        descricao: item.descricao,
                        status: data.status,
                        observacao: data.obs || '',
                        tem_foto: data.fotos.length > 0,
                        qtd_fotos: data.fotos.length
                    });
                });
            };

            if (cat.items) processItems(cat.items, cat.nome);
            if (cat.subcategorias) {
                cat.subcategorias.forEach(sub => processItems(sub.items, cat.nome + " > " + sub.nome));
            }
        });
        return detalhes;
    };

    const calculateStats = (currentItemsValue: VistoriaChecklistItems) => {
        let totalItems = 0;
        let preenchidos = 0;
        let naoConformes = 0;

        const traverse = (items: ChecklistItem[]) => {
            items.forEach(item => {
                totalItems++;
                const val = currentItemsValue[item.id];
                if (val && val.status) {
                    preenchidos++;
                    if (val.status === 'nao_conforme') naoConformes++;
                }
            });
        };

        categorias.forEach(cat => {
            if (cat.items) traverse(cat.items);
            if (cat.subcategorias) {
                cat.subcategorias.forEach(sub => traverse(sub.items));
            }
        });

        return { totalItems, preenchidos, naoConformes };
    };

    // Validation Logic
    const getValidationErrors = () => {
        const errors: string[] = [];
        // 1. Unanswered items
        const stats = calculateStats(itemsValue);
        if (stats.preenchidos < stats.totalItems) {
            errors.push(`${stats.totalItems - stats.preenchidos} item(ns) não vistoriado(s)`);
        }

        const allItemsFlat: ChecklistItem[] = [];
        categorias.forEach(c => {
            if (c.items) allItemsFlat.push(...c.items);
            if (c.subcategorias) c.subcategorias.forEach(s => allItemsFlat.push(...s.items));
        });

        // 2. NC mandatory obs
        if (obrigatorioObservacaoNC) {
            const ncSemObs = allItemsFlat.filter(item => {
                const val = itemsValue[item.id];
                return val && val.status === 'nao_conforme' && (!val.obs || val.obs.trim() === '');
            });
            if (ncSemObs.length > 0) errors.push(`${ncSemObs.length} não conformidade(s) sem descrição obrigatória`);
        }

        // 3. NC mandatory photo
        if (obrigatorioFotoNC && permitirFotos) {
            const ncSemFoto = allItemsFlat.filter(item => {
                const val = itemsValue[item.id];
                return val && val.status === 'nao_conforme' && (!val.fotos || val.fotos.length === 0);
            });
            if (ncSemFoto.length > 0) errors.push(`${ncSemFoto.length} não conformidade(s) sem foto de evidência`);
        }

        return errors;
    };

    const validationErrors = getValidationErrors();

    const renderItem = (item: ChecklistItem) => {
        const itemVal = itemsValue[item.id] || { status: null, obs: '', fotos: [] };
        const { status, fotos } = itemVal as ItemState;
        const isNC = status === 'nao_conforme';
        const isOK = status === 'conforme';
        const qtdFotos = fotos.length;

        return (
            <div key={item.id} className={cn(
                "border-b border-gray-100 last:border-0 py-4 px-2 hover:bg-gray-50/50 transition-colors",
                isNC ? "bg-red-50/30" : ""
            )}>
                <div className="flex flex-col gap-3">
                    <div className="font-medium text-sm text-gray-800">{item.descricao}</div>

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant={isOK ? "default" : "outline"}
                            className={cn(
                                "flex-1 h-10",
                                isOK ? "bg-green-600 hover:bg-green-700" : "text-gray-600 border-gray-300 hover:bg-green-50 hover:text-green-700 hover:border-green-300",
                                readOnly && "opacity-70 cursor-default hover:bg-transparent hover:text-gray-600 hover:border-gray-300"
                            )}
                            onClick={() => handleSetStatus(item.id, 'conforme')}
                            disabled={readOnly}
                        >
                            <Check className="w-4 h-4 mr-1.5" /> Conforme
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={isNC ? "destructive" : "outline"}
                            className={cn(
                                "flex-1 h-10",
                                isNC ? "" : "text-gray-600 border-gray-300 hover:bg-red-50 hover:text-red-700 hover:border-red-300",
                                readOnly && "opacity-70 cursor-default hover:bg-transparent hover:text-gray-600 hover:border-gray-300"
                            )}
                            onClick={() => handleSetStatus(item.id, 'nao_conforme')}
                            disabled={readOnly}
                        >
                            <X className="w-4 h-4 mr-1.5" /> Não Conforme
                        </Button>
                    </div>

                    {/* Details Section (NC or OK with optional fields) */}
                    {(isNC || isOK) && (
                        <div className={cn(
                            "mt-2 space-y-3 animate-in fade-in slide-in-from-top-1 px-1",
                            isNC ? "block" : (permitirFotos ? "block" : "hidden")
                        )}>
                            {isNC && (
                                <Textarea
                                    placeholder="Descreva a não conformidade..."
                                    value={itemVal.obs || ''}
                                    onChange={(e) => handleSetObs(item.id, e.target.value)}
                                    className="min-h-[80px] bg-white"
                                    disabled={readOnly}
                                />
                            )}

                            {permitirFotos && (
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <ImageIcon className="w-4 h-4 text-gray-500" />
                                        <span className="text-xs text-gray-600">
                                            {qtdFotos}/{maxFotos} fotos
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-3">
                                        {fotos.map((foto, index) => {
                                            // Handle both string (legacy) and object formats
                                            const uri = typeof foto === 'string' ? foto : foto.uri;
                                            return (
                                                <div key={index} className="relative group">
                                                    <img
                                                        src={uri}
                                                        alt={`Evidência ${index + 1}`}
                                                        className="w-20 h-20 object-cover rounded-lg border border-gray-200 shadow-sm"
                                                    />
                                                    {!readOnly && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemovePhoto(item.id, index)}
                                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-colors"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {!readOnly && qtdFotos < maxFotos && (
                                            <div className="relative">
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    capture="environment"
                                                    id={`camera-${item.id}`}
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        if (e.target.files?.[0]) handleCapturePhoto(item.id, e.target.files[0]);
                                                    }}
                                                />
                                                <label
                                                    htmlFor={`camera-${item.id}`}
                                                    className={cn(
                                                        "flex flex-col items-center justify-center w-20 h-20 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                                                        (isNC && obrigatorioFotoNC && qtdFotos === 0)
                                                            ? "border-red-300 bg-red-50/20 hover:bg-red-100/30"
                                                            : "border-gray-300 hover:bg-gray-50"
                                                    )}
                                                >
                                                    <Camera className={cn("w-5 h-5 mb-1", (isNC && obrigatorioFotoNC && qtdFotos === 0) ? "text-red-400" : "text-gray-400")} />
                                                    <span className="text-[9px] text-gray-500 text-center px-1">
                                                        {(isNC && obrigatorioFotoNC && qtdFotos === 0) ? "Foto Obrigatória" : "Adicionar"}
                                                    </span>
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const stats = useMemo(() => calculateStats(itemsValue), [itemsValue, categorias]);

    return (
        <div className="space-y-4">
            {/* Loading / Error feedback (bug C) */}
            {loading && (
                <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-sm text-blue-800 flex items-center gap-2">
                    <span className="animate-pulse">⏳</span> Carregando checklist…
                </div>
            )}
            {error && !loading && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Falha ao carregar checklist do registry: {error}
                </div>
            )}

            {/* Empty state quando nao ha categorias nem do registry nem do schema */}
            {!loading && !error && categorias.length === 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-md p-3 text-sm text-orange-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Nenhuma categoria de checklist configurada.
                </div>
            )}

            {/* Summary Card */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex flex-col items-center justify-center text-blue-900">
                    <span className="text-2xl font-bold">{stats.preenchidos}/{stats.totalItems}</span>
                    <span className="text-xs uppercase tracking-wider opacity-70">Vistoriados</span>
                </div>
                {stats.naoConformes > 0 ? (
                    <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex flex-col items-center justify-center text-red-900 animate-pulse">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600" />
                            <span className="text-2xl font-bold text-red-600">{stats.naoConformes}</span>
                        </div>
                        <span className="text-xs uppercase tracking-wider opacity-70 font-semibold">Não Conformes</span>
                    </div>
                ) : (
                    <div className="bg-green-50 border border-green-100 rounded-lg p-3 flex flex-col items-center justify-center text-green-900">
                        <div className="flex items-center gap-2">
                            <Check className="w-5 h-5 text-green-600" />
                            <span className="text-2xl font-bold text-green-600">0</span>
                        </div>
                        <span className="text-xs uppercase tracking-wider opacity-70">Não Conformidades</span>
                    </div>
                )}
            </div>

            {/* Validation Errors Area */}
            {validationErrors.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-md p-3 space-y-1">
                    <div className="text-orange-800 font-semibold text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> Pendências:
                    </div>
                    {validationErrors.map((err, idx) => (
                        <div key={idx} className="text-xs text-orange-700 ml-6 list-disc">
                            • {err}
                        </div>
                    ))}
                </div>
            )}

            {/* Categories Accordion */}
            <div className="space-y-3">
                {categorias.map(cat => {
                    const isExpanded = expandedCategories[cat.id];
                    // Calculate internal stats for preview
                    let catTotal = 0;
                    let catRealized = 0;
                    let catNC = 0;

                    const count = (list: ChecklistItem[]) => {
                        list.forEach(i => {
                            catTotal++;
                            if (itemsValue[i.id]?.status) {
                                catRealized++;
                                if (itemsValue[i.id]?.status === 'nao_conforme') catNC++;
                            }
                        })
                    };
                    if (cat.items) count(cat.items);
                    if (cat.subcategorias) cat.subcategorias.forEach(sub => count(sub.items));

                    const isComplete = catTotal > 0 && catRealized === catTotal;
                    const hasIssues = catNC > 0;

                    return (
                        <div key={cat.id} className={cn(
                            "border rounded-lg overflow-hidden transition-all",
                            hasIssues ? "border-red-200 shadow-sm" : (isComplete ? "border-green-200 bg-green-50/30" : "border-gray-200")
                        )}>
                            <button
                                type="button"
                                onClick={() => handleToggleCategory(cat.id)}
                                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl" role="img" aria-hidden="true">{cat.icone || '📋'}</span>
                                    <div className="text-left">
                                        <div className="font-semibold text-gray-800">{cat.nome}</div>
                                        <div className="text-xs text-muted-foreground flex gap-2">
                                            <span>{catRealized}/{catTotal} itens</span>
                                            {hasIssues && <span className="text-red-600 font-bold flex items-center gap-1">• {catNC} NCs</span>}
                                        </div>
                                    </div>
                                </div>
                                {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                            </button>

                            {isExpanded && (
                                <div className="bg-white border-t border-gray-100 p-2 pb-4">
                                    {cat.subcategorias ? (
                                        <div className="space-y-4 px-2">
                                            {cat.subcategorias.map(sub => (
                                                <div key={sub.id} className="space-y-2">
                                                    <h5 className="font-semibold text-sm text-gray-600 border-b border-gray-100 pb-1 mt-2">{sub.nome}</h5>
                                                    <div className="pl-0">
                                                        {sub.items.map(renderItem)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="px-2">
                                            {cat.items?.map(renderItem)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
