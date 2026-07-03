"use client";

import React from "react";
import type { FormContent, FormField } from "@/types";
import { EntityPickerDisplay } from "./fields/EntityPickerRenderer";

interface ReadOnlyFormRendererProps {
    schema: FormContent;
    values: Record<string, unknown>;
    formSnapshot?: FormContent;
}

interface FieldDef {
    id: string;
    type: string;
    label?: string;
    options?: { value: string; label: string }[];
    items?: { value: string; label: string }[];
    categorias?: unknown;
    dataSource?: string;
    source?: string;
    campos?: FormField[];
    config?: Record<string, unknown>;
}

function getLabel(field: FieldDef, value: unknown): string {
    const options = field.options || field.items || [];
    if (options.length > 0) {
        const found = options.find(o => String(o.value) === String(value));
        if (found) return found.label;
    }
    return String(value ?? "");
}

function formatDate(value: unknown): string {
    if (!value) return "";
    try {
        const d = new Date(String(value));
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
    } catch {
        return String(value);
    }
}

function formatDateTime(value: unknown): string {
    if (!value) return "";
    try {
        const d = new Date(String(value));
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleString("pt-BR");
    } catch {
        return String(value);
    }
}

function normalizeField(field: FormField): FieldDef {
    const f = field as unknown as FieldDef;
    return {
        id: f.id || "",
        type: (field.type || "text").toLowerCase(),
        label: f.label || field.label,
        options: f.options || "options" in field ? (field as unknown as { options?: { value: string; label: string }[] }).options : undefined,
        items: f.items,
        dataSource: f.dataSource,
        source: f.source,
        campos: field.campos,
        config: (field.config ?? {}) as Record<string, unknown>,
    };
}

export function ReadOnlyFormRenderer({ schema, values, formSnapshot }: ReadOnlyFormRendererProps) {
    const effectiveSchema = formSnapshot || schema;
    const fields = effectiveSchema.campos || [];

    if (!fields.length) {
        return (
            <div className="text-sm text-muted-foreground py-4">
                Nenhum campo definido no formulário.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {fields.map((field) => {
                const f = normalizeField(field);
                const rawValue = values[f.id] ?? values[field.id] ?? "";

                if (f.type === "hidden") return null;

                return (
                    <div key={f.id} className="border-b border-border/40 pb-2 last:border-0">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                            {f.label || f.id}
                        </div>
                        <div className="text-sm">
                            {renderFieldValue(f, rawValue, values, effectiveSchema)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function renderFieldValue(
    field: FieldDef,
    value: unknown,
    allValues: Record<string, unknown>,
    schema: FormContent
): React.ReactNode {
    const type = field.type;

    switch (type) {
        case "text":
        case "textarea":
        case "email":
        case "tel":
        case "url":
        case "password":
        case "number":
            return <span>{String(value ?? "") || <span className="text-muted-foreground italic">—</span>}</span>;

        case "date":
            return <span>{formatDate(value) || <span className="text-muted-foreground italic">—</span>}</span>;

        case "time":
            return <span>{String(value || "") || <span className="text-muted-foreground italic">—</span>}</span>;

        case "datetime_local":
        case "timestamp":
            return <span>{formatDateTime(value) || <span className="text-muted-foreground italic">—</span>}</span>;

        case "select":
        case "radio":
            return <span>{getLabel(field, value) || <span className="text-muted-foreground italic">—</span>}</span>;

        case "checkbox":
            return <span>{value ? "Sim" : "Não"}</span>;

        case "chips":
        case "chips_multiple": {
            const val = Array.isArray(value) ? value : (value ? [value] : []);
            if (!val.length) return <span className="text-muted-foreground italic">—</span>;
            return (
                <div className="flex flex-wrap gap-1">
                    {val.map((v, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                            {getLabel(field, v)}
                        </span>
                    ))}
                </div>
            );
        }

        case "photo":
        case "camera":
        case "file": {
            const str = String(value || "");
            if (!str) return <span className="text-muted-foreground italic">—</span>;
            const isUrl = str.startsWith("http") || str.startsWith("blob:");
            return (
                <div className="flex items-center gap-2">
                    {isUrl && /\.(png|jpg|jpeg|gif|webp)$/i.test(str) && (
                        <img src={str} alt="" className="h-10 w-10 object-cover rounded border" />
                    )}
                    <a href={isUrl ? str : "#"} className="text-primary underline text-xs truncate max-w-[200px]" target={isUrl ? "_blank" : undefined} rel="noreferrer">
                        {str.split("/").pop() || str}
                    </a>
                </div>
            );
        }

        case "gps": {
            const str = String(value || "");
            if (!str) return <span className="text-muted-foreground italic">—</span>;
            const coords = String(value);
            const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(coords)}`;
            return (
                <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-primary underline text-sm">
                    {coords}
                </a>
            );
        }

        case "checklist":
        case "vistoria_checklist": {
            // O renderer salva { items: Record<itemId, {status, obs, fotos}>,
            // detalhes, resumo, timestamp }. A leitura read-only precisa cruzar o
            // schema de categorias (estatico ou via registry) com os statuses.
            const v = value as { items?: Record<string, { status?: string }>; resumo?: { percentual_completo?: number } } | null | undefined;
            const itemsMap = v && typeof v === "object" && v.items && typeof v.items === "object"
                ? v.items as Record<string, { status?: string }>
                : {};
            const resumo = v && typeof v === "object" && v.resumo;

            // Achata as categorias em lista de {id, descricao} para exibir status.
            type FlatItem = { id: string; descricao: string; catNome?: string };
            const flat: FlatItem[] = [];
            const catsRaw = Array.isArray(field.categorias) ? field.categorias
                : Array.isArray(field.items) ? field.items
                : [];
            for (const c of catsRaw) {
                if (!c || typeof c !== "object") continue;
                const cat = c as { id?: string; nome?: string; items?: Array<{ id?: string; descricao?: string }>; subcategorias?: Array<{ nome?: string; items?: Array<{ id?: string; descricao?: string }> }> };
                if (Array.isArray(cat.items)) {
                    for (const it of cat.items) {
                        if (it && typeof it.id === "string" && typeof it.descricao === "string") {
                            flat.push({ id: it.id, descricao: it.descricao, catNome: cat.nome });
                        }
                    }
                }
                if (Array.isArray(cat.subcategorias)) {
                    for (const sub of cat.subcategorias) {
                        if (Array.isArray(sub.items)) {
                            for (const it of sub.items) {
                                if (it && typeof it.id === "string" && typeof it.descricao === "string") {
                                    flat.push({ id: it.id, descricao: it.descricao, catNome: `${cat.nome ?? ""} > ${sub.nome ?? ""}`.trim() });
                                }
                            }
                        }
                    }
                }
            }

            if (flat.length === 0) {
                // Sem schema de categorias: mostra ao menos o resumo se houver.
                if (resumo && typeof resumo === "object") {
                    const r = resumo as { itens_vistoriados?: number; total_itens?: number; nao_conformidades?: number; percentual_completo?: number };
                    return (
                        <div className="text-sm space-y-1">
                            <span>{r.itens_vistoriados ?? 0}/{r.total_itens ?? 0} vistoriados ({r.percentual_completo ?? 0}%)</span>
                            {(r.nao_conformidades ?? 0) > 0 && (
                                <span className="text-red-600"> · {r.nao_conformidades} NC(s)</span>
                            )}
                        </div>
                    );
                }
                return renderFallback(value);
            }

            const statusIcon = (s?: string) => {
                if (s === "conforme") return <span className="text-green-600 font-bold">✓</span>;
                if (s === "nao_conforme") return <span className="text-red-600 font-bold">✗</span>;
                if (s === "na") return <span className="text-muted-foreground">—</span>;
                return <span className="text-muted-foreground">○</span>;
            };

            return (
                <div className="space-y-1">
                    {flat.map((item, i) => {
                        const st = itemsMap[item.id]?.status;
                        return (
                            <div key={i} className="flex items-center gap-2 text-sm">
                                <span>{statusIcon(st)}</span>
                                <span>{item.descricao}</span>
                                {item.catNome && <span className="text-xs text-muted-foreground">({item.catNome})</span>}
                            </div>
                        );
                    })}
                </div>
            );
        }

        case "presence":
        case "presence_list":
        case "presence_compact":
        case "presence-compact":
        case "presence-list": {
            const v = value as { statuses?: Record<string, string>; summary?: { presente?: number; ausente?: number; desligado?: number }; timestamp?: string } | null | undefined;
            const statuses = v && typeof v === "object" && v.statuses ? v.statuses : {};
            const summary = v && typeof v === "object" && v.summary ? v.summary : null;
            const label = (s?: string) => s === "presente" ? "Presente" : s === "ausente" ? "Ausente" : s === "desligado" ? "Desligado" : "—";
            const color = (s?: string) => s === "presente" ? "text-green-600" : s === "ausente" ? "text-red-600" : s === "desligado" ? "text-gray-500" : "text-muted-foreground";

            if (Object.keys(statuses).length === 0) {
                return <span className="text-muted-foreground italic">—</span>;
            }
            return (
                <div className="space-y-1">
                    {summary && (
                        <div className="text-xs text-muted-foreground">
                            {summary.presente ?? 0} presente(s) · {summary.ausente ?? 0} ausente(s) · {summary.desligado ?? 0} desligado(s)
                        </div>
                    )}
                    <div className="flex flex-wrap gap-1">
                        {Object.entries(statuses).map(([id, s], i) => (
                            <span key={i} className={`text-xs ${color(s)}`}>
                                {label(s)}
                            </span>
                        ))}
                    </div>
                </div>
            );
        }

        case "group": {
            const subFields = field.campos || [];
            if (!subFields.length) return renderFallback(value);
            const subValues = (value && typeof value === "object" ? value : allValues) as Record<string, unknown>;
            return (
                <div className="ml-2 pl-3 border-l-2 border-border/50 space-y-2">
                    <ReadOnlyFormRenderer
                        schema={{ ...schema, campos: subFields }}
                        values={subValues}
                    />
                </div>
            );
        }

        case "repeatable_group": {
            const subFields = field.campos || [];
            const entries = Array.isArray(value) ? value : (value ? [value] : []);
            if (!entries.length) return <span className="text-muted-foreground italic">—</span>;
            if (!subFields.length) return renderFallback(value);
            return (
                <div className="space-y-2">
                    {entries.map((entry, i) => (
                        <details key={i} className="border rounded p-2 text-sm">
                            <summary className="cursor-pointer font-medium">
                                {`Registro ${i + 1}`}
                            </summary>
                            <div className="mt-2">
                                <ReadOnlyFormRenderer
                                    schema={{ ...schema, campos: subFields }}
                                    values={entry as Record<string, unknown>}
                                />
                            </div>
                        </details>
                    ))}
                </div>
            );
        }

        case "gallery": {
            const images = Array.isArray(value) ? value : (value ? [value] : []);
            if (!images.length) return <span className="text-muted-foreground italic">—</span>;
            return (
                <div className="flex flex-wrap gap-2">
                    {images.map((img: unknown, i: number) => {
                        const src = String(img || "");
                        return (
                            <img
                                key={i}
                                src={src}
                                alt={`Imagem ${i + 1}`}
                                className="h-12 w-12 object-cover rounded border"
                            />
                        );
                    })}
                </div>
            );
        }

        case "entity_picker": {
            const cfg = field.config ?? {};
            return (
                <EntityPickerDisplay
                    value={String(value || "")}
                    entityType={String(cfg.entityType ?? field.dataSource ?? "pj")}
                    displayTemplate={cfg.displayTemplate as string | undefined}
                />
            );
        }

        default:
            return renderFallback(value);
    }
}

function renderFallback(value: unknown): React.ReactNode {
    if (value === null || value === undefined || value === "") {
        return <span className="text-muted-foreground italic">—</span>;
    }
    if (typeof value === "object") {
        return <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-32">{JSON.stringify(value, null, 2)}</pre>;
    }
    return <span>{String(value)}</span>;
}
