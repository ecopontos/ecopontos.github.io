"use client";

import { useState, useEffect } from "react";
import { FormField } from "@/types";
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/src/lib/utils";

interface OccupationCaixa {
    id: number;
    nome: string;
    icone?: string;
}

export interface OccupationValue {
    ocupacao?: Record<string, string>;
    removidas?: Record<string, boolean>;
    timestamp?: string;
}

interface OccupationRendererProps {
    field: FormField;
    value: OccupationValue | null | undefined;
    onChange: (value: OccupationValue) => void;
    readOnly?: boolean;
}

const DEFAULT_CAIXAS = [
    { id: 1, nome: 'Papel/Papelão', icone: '📄' },
    { id: 2, nome: 'Plástico', icone: '🧴' },
    { id: 3, nome: 'Vidro', icone: '🍾' },
    { id: 4, nome: 'Metal', icone: '🔧' },
    { id: 5, nome: 'Orgânico', icone: '🍃' },
    { id: 6, nome: 'Rejeito', icone: '🗑️' },
    { id: 7, nome: 'Eletrônicos', icone: '💻' }
];

const NIVEIS = [
    { valor: '0', label: '0%', color: 'bg-green-100 hover:bg-green-200 border-green-400 text-green-800', icon: '✓' },
    { valor: '50', label: '50%', color: 'bg-yellow-100 hover:bg-yellow-200 border-yellow-400 text-yellow-800', icon: '⚠' },
    { valor: '75', label: '75%', color: 'bg-orange-100 hover:bg-orange-200 border-orange-400 text-orange-800', icon: '⚡' },
    { valor: '100', label: '100%', color: 'bg-red-100 hover:bg-red-200 border-red-400 text-red-800', icon: '🔴' }
];

export function OccupationRenderer({ field, value, onChange, readOnly = false }: OccupationRendererProps) {
    // Internal state to manage UI if value is null
    const [expandedBox, setExpandedBox] = useState<number | null>(null);

    // Normalize value structure
    const formValue = value || { ocupacao: {}, removidas: {} };
    const ocupacao = formValue.ocupacao || {};
    const removidas = formValue.removidas || {};

    const caixas: OccupationCaixa[] = Array.isArray(field.items) && field.items.length > 0
        ? field.items.flatMap((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
                return [];
            }

            const caixa = item as Record<string, unknown>;
            if (typeof caixa.id !== "number" || typeof caixa.nome !== "string") {
                return [];
            }

            return [{
                id: caixa.id,
                nome: caixa.nome,
                icone: typeof caixa.icone === "string" ? caixa.icone : undefined,
            }];
        })
        : DEFAULT_CAIXAS;

    const handleToggle = (id: number) => {
        setExpandedBox(expandedBox === id ? null : id);
    };

    const handleSelectLevel = (caixaId: number, nivel: string) => {
        if (readOnly) return;
        const nextOcupacao = { ...ocupacao, [caixaId]: nivel };
        // If selecting a level, ensure it's not marked as removed
        const nextRemovidas = { ...removidas };
        delete nextRemovidas[caixaId];

        onChange({
            ...formValue,
            ocupacao: nextOcupacao,
            removidas: nextRemovidas,
            timestamp: new Date().toISOString()
        });
    };

    const handleMarkRemoved = (caixaId: number) => {
        if (readOnly) return;
        if (confirm("Tem certeza que deseja marcar esta caixa como removida?")) {
            onChange({
                ...formValue,
                removidas: { ...removidas, [caixaId]: true },
                timestamp: new Date().toISOString()
            });
        }
    };

    const handleUndoRemoval = (caixaId: number) => {
        if (readOnly) return;
        const nextRemovidas = { ...removidas };
        delete nextRemovidas[caixaId];
        onChange({
            ...formValue,
            removidas: nextRemovidas,
            timestamp: new Date().toISOString()
        });
    };

    const getStatusContent = (caixaId: number) => {
        if (removidas[caixaId]) return <span className="text-xs font-bold text-gray-500 flex items-center gap-1">✅ Removida</span>;

        const nivel = ocupacao[caixaId];
        if (!nivel) return <span className="text-xs text-muted-foreground">Não preenchido</span>;

        const nivelObj = NIVEIS.find(n => n.valor === nivel);
        return (
            <span className={cn(
                "text-xs font-bold px-2 py-0.5 rounded-full border",
                nivelObj?.color || "bg-gray-100"
            )}>
                {nivelObj?.icon} {nivel}%
            </span>
        );
    };

    return (
        <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Toque em cada caixa para selecionar o nível de ocupação</p>

            <div className="flex flex-col gap-2">
                {caixas.map((caixa) => {
                    const isExpanded = expandedBox === caixa.id;
                    const isRemoved = !!removidas[caixa.id];
                    const currentLevel = ocupacao[caixa.id];
                    const needsRemoval = currentLevel === '75' || currentLevel === '100';

                    return (
                        <div key={caixa.id} className={cn(
                            "border rounded-lg overflow-hidden transition-all",
                            isRemoved ? "bg-gray-50 border-gray-200 opacity-75" : "bg-white border-gray-200 shadow-sm"
                        )}>
                            <button
                                type="button"
                                onClick={() => handleToggle(caixa.id)}
                                className="w-full flex items-center justify-between p-3 py-4 text-left hover:bg-gray-50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl" role="img" aria-hidden="true">{caixa.icone || '📦'}</span>
                                    <span className="font-medium text-sm">{caixa.nome}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    {getStatusContent(caixa.id)}
                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="p-4 border-t bg-gray-50/50">
                                    {isRemoved ? (
                                        <div className="flex flex-col items-center justify-center p-4 bg-green-50 rounded-lg border border-green-100 text-center space-y-3">
                                            <CheckCircle className="w-8 h-8 text-green-500" />
                                            <div>
                                                <h5 className="font-semibold text-green-900">Caixa Removida</h5>
                                                <p className="text-xs text-green-700">Esta caixa foi marcada como removida.</p>
                                            </div>
                                            {!readOnly && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleUndoRemoval(caixa.id)}
                                                    className="bg-white hover:bg-green-100 text-green-700 border-green-200"
                                                >
                                                    <Undo2 className="w-4 h-4 mr-2" /> Desfazer Remoção
                                                </Button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-4 gap-2">
                                                {NIVEIS.map((nivel) => (
                                                    <button
                                                        key={nivel.valor}
                                                        type="button"
                                                        onClick={() => handleSelectLevel(caixa.id, nivel.valor)}
                                                        disabled={readOnly}
                                                        className={cn(
                                                            "flex flex-col items-center justify-center p-2 rounded-lg border transition-all h-20 shadow-sm",
                                                            !readOnly && "active:scale-95 hover:bg-gray-50 hover:border-gray-300",
                                                            readOnly && "opacity-70 cursor-default",
                                                            currentLevel === nivel.valor
                                                                ? cn("ring-2 ring-offset-1 ring-blue-500 transform scale-105 z-10 font-bold shadow-md", nivel.color)
                                                                : "bg-white border-gray-200 text-gray-600"
                                                        )}
                                                    >
                                                        <span className="text-xl mb-1">{nivel.icon}</span>
                                                        <span className="text-xs">{nivel.label}</span>
                                                    </button>
                                                ))}
                                            </div>

                                            {needsRemoval && !readOnly && (
                                                <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() => handleMarkRemoved(caixa.id)}
                                                        className="w-full flex items-center justify-center gap-2 p-4 h-auto bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg group"
                                                    >
                                                        <div className="bg-white p-2 rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                                            <Trash2 className="w-4 h-4 text-red-500" />
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="font-semibold text-sm">Marcar como Removida</div>
                                                            <div className="text-[10px] opacity-80">A equipe removeu esta caixa?</div>
                                                        </div>
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                    }
                                </div>
                            )}
                        </div>
                    );
                })}
            </div >
        </div >
    );
}
