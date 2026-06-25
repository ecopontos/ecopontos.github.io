"use client";

import { useMemo } from "react";
import { FormField } from "@/types";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useDataRegistryAggregated } from "@/src/interface/hooks/catalog/data-registry";
import { cn } from "@/src/lib/utils";
import { getRegistrySource, normalizeSelectionOptions, type SelectionValue } from "./option-utils";

interface RadioRendererProps {
    field: FormField;
    value: SelectionValue | null | undefined;
    onChange: (value: string) => void;
    readOnly?: boolean;
}

export function RadioRenderer({ field, value, onChange, readOnly = false }: RadioRendererProps) {
    // Fetch data if dataSource is provided
    const { data: fetchedData } = useDataRegistryAggregated(getRegistrySource(field));

    // Normalize options with proper memoization
    const options = useMemo(() => {
        // Combine explicit options with fetched data
        const rawOptions = [...(field.options || []), ...fetchedData];

        return normalizeSelectionOptions(rawOptions);
    }, [field.options, fetchedData]);

    return (
        <RadioGroup
            value={value ? String(value) : undefined}
            onValueChange={onChange}
            disabled={readOnly}
            className={cn("grid gap-2", options.length > 5 ? "grid-cols-2" : "grid-cols-1")}
        >
            {options.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhuma opção disponível</div>
            ) : (
                options.map((opt) => (
                    <div key={opt.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={opt.value} id={`${field.id}-${opt.value}`} />
                        <Label htmlFor={`${field.id}-${opt.value}`} className={cn("font-normal", !readOnly && "cursor-pointer", readOnly && "opacity-70")}>
                            {opt.label}
                        </Label>
                    </div>
                ))
            )}
        </RadioGroup>
    );
}
