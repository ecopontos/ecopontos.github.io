"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormField } from "@/types";
import { useCrmDataSource } from "@/src/interface/hooks/utils/useCrmDataSource";

interface EntityRow {
    id: string | number;
    nome: string;
    nome_galpao?: string;
    documento?: string;
    [key: string]: unknown;
}

interface EntityPickerConfig {
    entityType?: string;
    searchFields?: string[];      // default: ["nome", "documento"]
    displayTemplate?: string;     // e.g. "{nome} — {documento}", placeholders interpolated
    searchPlaceholder?: string;   // overrides the auto-generated placeholder
}

interface EntityPickerRendererProps {
    field: FormField;
    value: string;
    onChange: (val: string) => void;
    readOnly?: boolean;
}

function getEntityType(field: FormField): string {
    const config = field.config as EntityPickerConfig | undefined;
    return config?.entityType ?? String(field.dataSource ?? "pj");
}

function dataSourceForEntity(entityType: string): string {
    const map: Record<string, string> = {
        pj: "clientes_crm",
        pf: "pessoas_fisicas_crm",
        ecoponto: "ecopontos_crm",
        cooperativa: "cooperativas_crm",
        galpao: "galpoes_crm",
    };
    return map[entityType] ?? entityType;
}

function renderDisplay(entity: EntityRow, template?: string): string {
    if (template) {
        return template
            .replace(/\{(\w+)\}/g, (_, key) => (entity[key] != null ? String(entity[key]) : ""))
            .replace(/\s*[—\-]\s*$/g, "") // trim trailing separator when last field is empty
            .trim();
    }
    if (entity.nome_galpao) return `${entity.nome} — ${entity.nome_galpao}`;
    if (entity.documento)   return `${entity.nome} — ${entity.documento}`;
    return entity.nome;
}

/**
 * Standalone resolver — used by ReadOnlyFormRenderer and any context that only
 * has the stored entity ID and needs to display the human-readable name.
 * Takes flat props (no FormField dependency) so callers don't need the full type.
 */
export function EntityPickerDisplay({
    value,
    entityType = "pj",
    displayTemplate,
}: {
    value: string;
    entityType?: string;
    displayTemplate?: string;
}) {
    const [label, setLabel] = useState("");
    const dataSourceName = dataSourceForEntity(entityType);
    const { rows } = useCrmDataSource<EntityRow>(dataSourceName);

    useEffect(() => {
        if (!value || !rows.length) return;
        const entity = rows.find((e) => String(e.id) === String(value));
        if (entity) setLabel(renderDisplay(entity, displayTemplate));
    }, [value, rows, displayTemplate]);

    if (!value) return <span className="text-muted-foreground italic">—</span>;
    return <span>{label || value}</span>;
}

export function EntityPickerRenderer({ field, value, onChange, readOnly }: EntityPickerRendererProps) {
    const config = (field.config ?? {}) as EntityPickerConfig;
    const searchFields = config.searchFields ?? ["nome", "documento"];
    const displayTemplate = config.displayTemplate;

    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [selectedLabel, setSelectedLabel] = useState("");
    const wrapperRef = useRef<HTMLDivElement>(null);

    const entityType = getEntityType(field);
    const dataSourceName = dataSourceForEntity(entityType);
    const { rows: entities, loading } = useCrmDataSource<EntityRow>(dataSourceName);

    // Resolve display label whenever value or entities change
    useEffect(() => {
        if (!value || !entities.length) return;
        const entity = entities.find((e) => String(e.id) === String(value));
        if (entity) setSelectedLabel(renderDisplay(entity, displayTemplate));
    }, [value, entities, displayTemplate]);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    const filtered = useMemo(() => {
        if (!query.trim()) return entities;
        const q = query.toLowerCase();
        return entities.filter((e) =>
            searchFields.some((f) => {
                const v = e[f];
                return v != null && String(v).toLowerCase().includes(q);
            })
        );
    }, [entities, query, searchFields]);

    const handleSelect = (entity: EntityRow) => {
        setSelectedLabel(renderDisplay(entity, displayTemplate));
        onChange(String(entity.id));
        setQuery("");
        setOpen(false);
    };

    const placeholder =
        config.searchPlaceholder ??
        `Buscar ${entityType === "pj" ? "cliente" : entityType === "pf" ? "pessoa" : entityType}...`;

    if (readOnly) {
        return (
            <div className="space-y-1">
                {field.label && <Label className="text-xs">{field.label}</Label>}
                <div className="text-sm py-1.5 px-3 border rounded-md bg-muted/30">
                    {loading
                        ? <span className="text-muted-foreground italic">...</span>
                        : selectedLabel || value || <span className="text-muted-foreground italic">—</span>
                    }
                </div>
            </div>
        );
    }

    return (
        <div ref={wrapperRef} className="space-y-1 relative">
            {field.label && (
                <Label>
                    {field.label}
                    {field.required && <span className="text-destructive"> *</span>}
                </Label>
            )}
            <Input
                value={open ? query : (selectedLabel || query)}
                placeholder={placeholder}
                onChange={(e) => {
                    const val = e.target.value;
                    setQuery(val);
                    if (!open) {
                        setOpen(true);
                        if (selectedLabel && val !== selectedLabel) {
                            setSelectedLabel("");
                            onChange("");
                        }
                    }
                }}
                onFocus={() => {
                    if (!open) {
                        setQuery("");
                        setOpen(true);
                    }
                }}
                required={field.required}
            />
            {open && (
                <div className="absolute z-50 w-full mt-1 border rounded-md bg-popover shadow-md max-h-48 overflow-y-auto">
                    {loading ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Carregando...</div>
                    ) : filtered.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum resultado</div>
                    ) : (
                        filtered.map((entity) => (
                            <button
                                key={String(entity.id)}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelect(entity);
                                }}
                            >
                                <span className="font-medium">{entity.nome}</span>
                                {entity.documento && (
                                    <span className="ml-2 text-xs text-muted-foreground">{entity.documento}</span>
                                )}
                                {entity.nome_galpao && (
                                    <span className="ml-2 text-xs text-muted-foreground">— {entity.nome_galpao}</span>
                                )}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
