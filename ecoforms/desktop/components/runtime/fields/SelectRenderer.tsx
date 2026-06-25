"use client";

import { useMemo, memo } from "react";
import { FormField } from "@/types";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useDataRegistryAggregated } from "@/src/interface/hooks/catalog/data-registry";
import { getRegistrySource, normalizeSelectionOptions, type NormalizedSelectionOption, type SelectionValue } from "./option-utils";

/**
 * Auto-detect which property on the options array represents the foreign key
 * to the parent field when `filterProperty` is not explicitly configured.
 *
 * 1. If parentFieldId exists as a key on the first option → use it (backward compat)
 * 2. Otherwise scan options for a non-standard key whose value matches dependencyValue
 * 3. Fallback: use the first non-standard key on the first option (likely FK like setor_id)
 * 4. If nothing found → return undefined (skip filtering, show all)
 */
function detectFilterProperty(
    options: NormalizedSelectionOption[],
    dependencyValue: unknown,
    parentFieldId: string | undefined,
): string | undefined {
    if (!options.length) return parentFieldId;

    // Backward compat: if parent field ID happens to be a property on the option objects
    if (parentFieldId && parentFieldId in options[0]) return parentFieldId;

    // Auto-detect: find a property whose value matches the dependency value
    const standardKeys = new Set(["value", "label", "id", "nome", "name"]);
    if (dependencyValue != null && dependencyValue !== "") {
        const strDep = String(dependencyValue);
        for (const opt of options) {
            for (const key of Object.keys(opt)) {
                if (standardKeys.has(key)) continue;
                if (String(opt[key]) === strDep) return key;
            }
        }
    }

    // Fallback: if no property value matches, use first non-standard key
    // (most likely a foreign key like setor_id, bairro_id, etc.)
    for (const key of Object.keys(options[0])) {
        if (!standardKeys.has(key)) return key;
    }

    return undefined;
}

interface SelectRendererProps {
    field: FormField;
    value: SelectionValue | null | undefined;
    onChange: (value: string) => void;
    readOnly?: boolean;
    dependencyValue?: unknown; // Receives only the specific value it depends on
}

export const SelectRenderer = memo(function SelectRenderer({ field, value, onChange, readOnly = false, dependencyValue }: SelectRendererProps) {
    // Fetch data if dataSource is provided
    const { data: fetchedData } = useDataRegistryAggregated(getRegistrySource(field));

    const filterProperty = field.dependency?.filterProperty;

    // Memoize options calculation to prevent infinite re-renders
    const options = useMemo(() => {
        // Combine explicit options with fetched data
        const rawOptions = [...(field.options || []), ...(fetchedData || [])];

        // Normalize options
        const normalizedOptions = normalizeSelectionOptions(rawOptions);

        // Determine the effective property to filter by:
        // 1. Explicit filterProperty from dependency config
        // 2. Fallback: auto-detect from options based on the parent field value
        const effectiveFilterProperty = filterProperty ||
            detectFilterProperty(normalizedOptions, dependencyValue, field.dependency?.fieldId);

        // Apply dependency filtering
        return normalizedOptions.filter(opt => {
            if (!field.dependency) return true;

            // If parent has no value, usually we hide options or show all?
            // Standard behavior: show nothing if parent is required but empty.
            // If not required, maybe show all? Let's be strict: if dependency exists, parent must match.
            if (dependencyValue === undefined || dependencyValue === null || dependencyValue === "") return false;

            // If we can't determine a property to filter by, don't filter at all
            if (!effectiveFilterProperty) return true;

            // Loose comparison (string vs number)
            return String(opt[effectiveFilterProperty]) === String(dependencyValue);
        });
    }, [field.options, field.dependency, fetchedData, dependencyValue, filterProperty]);

    // Ensure Select receives a string value (Radix Select expects string)
    const controlledValue = useMemo(() => {
        return typeof value === "string" ? value : (value != null ? String(value) : "");
    }, [value]);

    return (
        <Select value={controlledValue} onValueChange={onChange} required={field.required} disabled={readOnly}>
            <SelectTrigger id={field.id}>
                <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
                {options.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">Nenhuma opção disponível</div>
                ) : (
                    options.map((opt, idx: number) => (
                        <SelectItem key={`${opt.value}-${idx}`} value={String(opt.value)}>
                            {opt.label}
                        </SelectItem>
                    ))
                )}
            </SelectContent>
        </Select>
    );
});
