import { FormField } from "@/types";

export type SelectionValue = string | number;

type RawOptionObject = {
    value?: unknown;
    label?: unknown;
    id?: unknown;
    nome?: unknown;
    name?: unknown;
    [key: string]: unknown;
};

export type SelectionSourceOption = string | RawOptionObject;

export interface NormalizedSelectionOption extends Record<string, unknown> {
    value: string;
    label: string;
}

function toRecord(value: unknown): RawOptionObject | null {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as RawOptionObject) : null;
}

function toDisplayValue(value: unknown): string | null {
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    return null;
}

export function normalizeSelectionOptions(rawOptions: unknown[]): NormalizedSelectionOption[] {
    return rawOptions.flatMap<NormalizedSelectionOption>((option) => {
        if (typeof option === "string") {
            return [{ value: option, label: option }];
        }

        const optionRecord = toRecord(option);
        if (!optionRecord) {
            return [];
        }

        const value = toDisplayValue(optionRecord.value)
            ?? toDisplayValue(optionRecord.id)
            ?? toDisplayValue(optionRecord.nome);
        const label = toDisplayValue(optionRecord.label)
            ?? toDisplayValue(optionRecord.nome)
            ?? toDisplayValue(optionRecord.name)
            ?? toDisplayValue(optionRecord.value)
            ?? toDisplayValue(optionRecord.id);

        if (!value || !label) {
            return [];
        }

        const normalizedOption: NormalizedSelectionOption = {
            ...optionRecord,
            value,
            label,
        };

        return [normalizedOption];
    });
}

export function normalizeSelectionLabels(rawOptions: unknown[]): string[] {
    return normalizeSelectionOptions(rawOptions).map((option) => option.label);
}

export function getRegistrySource(field: Pick<FormField, "dataSource" | "source">): string | undefined {
    if (typeof field.dataSource === "string") {
        return field.dataSource;
    }

    if (typeof field.source === "string") {
        return field.source;
    }

    return undefined;
}