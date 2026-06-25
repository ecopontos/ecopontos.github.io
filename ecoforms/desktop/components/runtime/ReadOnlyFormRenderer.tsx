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
            const items = field.options || field.items;
            if (!items) return renderFallback(value);
            return (
                <div className="space-y-1">
                    {items.map((item, i) => {
                        const itemValue = Array.isArray(value)
                            ? value.includes(item.value)
                            : String(value) === String(item.value);
                        return (
                            <div key={i} className="flex items-center gap-2 text-sm">
                                <span className={itemValue ? "text-green-600" : "text-muted-foreground"}>
                                    {itemValue ? "✓" : "○"}
                                </span>
                                <span>{item.label}</span>
                            </div>
                        );
                    })}
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
