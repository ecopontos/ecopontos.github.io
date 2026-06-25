"use client";

import { ChangeEvent, useMemo } from "react";
import { FormField } from "@/types";
import { Input } from "@/components/ui/input";
import { useDataRegistryAggregated } from "@/src/interface/hooks/catalog/data-registry";
import { normalizeSelectionLabels } from "./option-utils";

interface AutocompleteRendererProps {
    field: FormField;
    value: string | number | null | undefined;
    onChange: (value: string) => void;
    readOnly?: boolean;
}

function getRegistrySource(field: FormField): string | undefined {
    if (typeof field.dataSource === "string") {
        return field.dataSource;
    }

    if (typeof field.source === "string") {
        return field.source;
    }

    return undefined;
}

export function AutocompleteRenderer({ field, value, onChange, readOnly = false }: AutocompleteRendererProps) {
    // Fetch data for suggestions
    const { data: fetchedData } = useDataRegistryAggregated(getRegistrySource(field));

    // Normalize options to list of strings for datalist with proper memoization
    const suggestions = useMemo(() => {
        // Combine explicit options with fetched data
        const rawOptions = [...(field.options || []), ...fetchedData];

        return normalizeSelectionLabels(rawOptions);
    }, [field.options, fetchedData]);

    const datalistId = `${field.id}-list`;

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    return (
        <div className="relative">
            <Input
                id={field.id}
                value={value != null ? String(value) : ""}
                onChange={handleChange}
                placeholder={field.label}
                required={field.required}
                list={datalistId}
                autoComplete="off" // Disable browser history autocomplete to show our list
                disabled={readOnly}
            />
            {suggestions.length > 0 && (
                <datalist id={datalistId}>
                    {suggestions.map((item, idx) => (
                        <option key={`${idx}-${item}`} value={item} />
                    ))}
                </datalist>
            )}
        </div>
    );
}
