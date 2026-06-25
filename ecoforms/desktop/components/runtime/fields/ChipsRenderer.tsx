import { useState, useEffect, useMemo } from "react";
import { FormField } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/src/lib/utils";
import { useDataRegistryAggregated } from "@/src/interface/hooks/catalog/data-registry";
import { getRegistrySource, normalizeSelectionOptions } from "./option-utils";

interface ChipsRendererProps {
    field: FormField;
    value: string[] | string | null | undefined;
    onChange: (value: string[]) => void;
    readOnly?: boolean;
}

export function ChipsRenderer({ field, value, onChange, readOnly = false }: ChipsRendererProps) {
    // Parse initial value if it's a string (legacy compatibility)
    const initialSelected = Array.isArray(value)
        ? value
        : (typeof value === 'string' ? JSON.parse(value || '[]') : []);

    const [selected, setSelected] = useState<string[]>(initialSelected);

    // Fetch data if dataSource is provided (legacy field often uses 'dataSource': 'bairros')
    const { data: fetchedData } = useDataRegistryAggregated(getRegistrySource(field));

    // Parse options from config/fetched with proper memoization
    const options = useMemo(() => {
        // Combine explicit options with fetched data
        const rawOptions = [...(field.options || []), ...fetchedData];

        return normalizeSelectionOptions(rawOptions);
    }, [field.options, fetchedData]);

    const toggleChip = (optionValue: string) => {
        if (readOnly) return;
        const newSelected = selected.includes(optionValue)
            ? selected.filter((v) => v !== optionValue)
            : [...selected, optionValue];

        setSelected(newSelected);
        onChange(newSelected);
    };

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
                {options.map((option) => {
                    const isSelected = selected.includes(option.value);
                    return (
                        <Badge
                            key={option.value}
                            variant={isSelected ? "default" : "outline"}
                            className={cn(
                                "px-3 py-1 text-sm select-none transition-all",
                                !readOnly && "cursor-pointer hover:opacity-80",
                                readOnly && "opacity-60",
                                isSelected ? "bg-primary text-primary-foreground" : "bg-background",
                                !readOnly && !isSelected && "hover:bg-accent"
                            )}
                            onClick={() => toggleChip(option.value)}
                        >
                            {option.label}
                        </Badge>
                    );
                })}
            </div>
            {options.length === 0 && (
                <span className="text-sm text-muted-foreground italic">Sem opções disponíveis.</span>
            )}
        </div>
    );
}
