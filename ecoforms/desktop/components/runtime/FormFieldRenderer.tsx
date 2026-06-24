"use client";

import { ChangeEvent, useEffect, useEffectEvent, useMemo, useState } from "react";
import { FormField } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";
import { PresenceRenderer } from "./fields/PresenceRenderer";
import { ChipsRenderer } from "./fields/ChipsRenderer";
import { SelectRenderer } from "./fields/SelectRenderer";
import { RadioRenderer } from "./fields/RadioRenderer";
import { CheckboxRenderer } from "./fields/CheckboxRenderer";
import { GalleryRenderer } from "./fields/GalleryRenderer";
import { AutocompleteRenderer } from "./fields/AutocompleteRenderer";
import { OccupationRenderer } from "./fields/OccupationRenderer";
import { VistoriaChecklistRenderer } from "./fields/VistoriaChecklistRenderer";
import { GPSRenderer } from "./fields/GPSRenderer";
import { PhotoRenderer } from "./fields/PhotoRenderer";
import { EntityPickerRenderer } from "./fields/EntityPickerRenderer";
import { RepeatableGroupRenderer } from "./fields/RepeatableGroupRenderer";
import type { GalleryItem } from "./fields/GalleryRenderer";
import type { GPSData } from "./fields/GPSRenderer";
import type { OccupationValue } from "./fields/OccupationRenderer";
import type { RepeatableItem } from "./fields/RepeatableGroupRenderer";
import type { VistoriaChecklistItems, VistoriaChecklistValue } from "./fields/VistoriaChecklistRenderer";
import { Textarea } from "@/components/ui/textarea";
import { evaluateVisibilityRules } from "@/src/interface/hooks/catalog/forms";
import { normalizeFieldType } from "@/src/lib/field-type-map";
import { getBrasiliaNow } from "@/src/lib/brasilia-time";

type FormFieldPrimitive = string | number | boolean | null | undefined;
export type FormFieldObjectValue = { [key: string]: FormFieldValue };
export type FormFieldValue = FormFieldPrimitive | File | FormFieldObjectValue | FormFieldValue[];
type GalleryFieldItem = { name: string; [key: string]: FormFieldValue };

function toInputValue(value: FormFieldValue): string | number {
    if (typeof value === "string" || typeof value === "number") {
        return value;
    }

    if (typeof value === "boolean") {
        return value ? "true" : "false";
    }

    if (value == null) {
        return "";
    }

    return JSON.stringify(value);
}

function toTextValue(value: FormFieldValue): string {
    return String(toInputValue(value));
}

function toScalarSelectionValue(value: FormFieldValue): string | number | null | undefined {
    if (typeof value === "string" || typeof value === "number") {
        return value;
    }

    return value == null ? value : undefined;
}

function toStringArrayValue(value: FormFieldValue): string[] | string | null | undefined {
    if (Array.isArray(value)) {
        return value.flatMap((item) => typeof item === "string" ? [item] : []);
    }

    if (typeof value === "string" || value == null) {
        return value;
    }

    return undefined;
}

function toCheckboxValue(value: FormFieldValue): boolean | string | number | null | undefined {
    if (typeof value === "boolean" || typeof value === "string" || typeof value === "number" || value == null) {
        return value;
    }

    return undefined;
}

function toPresenceValue(value: FormFieldValue): Record<string, unknown> | null | undefined {
    if (value == null) {
        return value;
    }

    return value && typeof value === "object" && !Array.isArray(value) && !(value instanceof File) ? value : undefined;
}

function fromPresenceValue(value: object | null | undefined): FormFieldObjectValue | null | undefined {
    if (value == null) {
        return value;
    }

    return { ...value } as unknown as FormFieldObjectValue;
}

function toPhotoValue(value: FormFieldValue): File | string | Record<string, unknown> | null | undefined {
    if (value == null || value instanceof File || typeof value === "string") {
        return value;
    }

    return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function toGpsValue(value: FormFieldValue): GPSData | null | undefined {
    if (value == null) {
        return value;
    }

    if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof File) {
        return undefined;
    }

    if (
        typeof value.lat === "number"
        && typeof value.lng === "number"
        && typeof value.accuracy === "number"
        && typeof value.timestamp === "number"
    ) {
        return {
            lat: value.lat,
            lng: value.lng,
            accuracy: value.accuracy,
            timestamp: value.timestamp,
            altitude: typeof value.altitude === "number" || value.altitude === null ? value.altitude : undefined,
            speed: typeof value.speed === "number" || value.speed === null ? value.speed : undefined,
        };
    }

    return undefined;
}

function toOccupationValue(value: FormFieldValue): OccupationValue | null | undefined {
    if (value == null) {
        return value;
    }

    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof File)) {
        return value as unknown as OccupationValue;
    }

    return undefined;
}

function fromOccupationValue(value: OccupationValue | null | undefined): FormFieldObjectValue | null | undefined {
    if (value == null) {
        return value;
    }

    return { ...value } as unknown as FormFieldObjectValue;
}

function toVistoriaChecklistValue(value: FormFieldValue): VistoriaChecklistValue | VistoriaChecklistItems | null | undefined {
    if (value == null) {
        return value;
    }

    if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof File)) {
        return value as unknown as VistoriaChecklistValue | VistoriaChecklistItems;
    }

    return undefined;
}

function fromVistoriaChecklistValue(value: VistoriaChecklistValue): FormFieldObjectValue {
    return { ...value } as unknown as FormFieldObjectValue;
}

function toArrayValue(value: FormFieldValue): FormFieldValue[] {
    return Array.isArray(value) ? value : [];
}

function toGalleryItems(value: FormFieldValue): GalleryFieldItem[] {
    return toArrayValue(value).filter((item): item is GalleryFieldItem => {
        return !!item && typeof item === "object" && !Array.isArray(item) && "name" in item && typeof item.name === "string";
    });
}

function fromGalleryItems(items: GalleryItem[]): FormFieldObjectValue[] {
    return items.map((item) => ({
        name: item.name,
        size: item.size,
        type: item.type,
        lastModified: item.lastModified,
        virtualUrl: item.virtualUrl,
        url: item.url,
        uri: item.uri,
        preview: item.preview,
        file: item.file,
    }));
}

function toRepeatableItems(value: FormFieldValue): RepeatableItem[] {
    return toArrayValue(value).filter((item): item is RepeatableItem => {
        return !!item && typeof item === "object" && !Array.isArray(item) && !(item instanceof File);
    });
}

function fromRepeatableItems(items: RepeatableItem[]): FormFieldObjectValue[] {
    return items.map((item) => ({ ...item }));
}

function getNamedValue(value: FormFieldValue): string | null {
    if (value && typeof value === "object" && !Array.isArray(value) && "name" in value) {
        const fileName = value.name;
        return typeof fileName === "string" ? fileName : null;
    }

    return null;
}

function toObjectValue(value: FormFieldValue): FormFieldObjectValue {
    return value && typeof value === "object" && !Array.isArray(value) && !(value instanceof File) ? value : {};
}

interface FormFieldRendererProps {
    field: FormField;
    value: FormFieldValue;
    onChange: (value: FormFieldValue) => void;
    readOnly?: boolean;
    formData?: Record<string, unknown>;
}


export function FormFieldRenderer({ field, value, onChange, readOnly = false, formData = {} }: FormFieldRendererProps) {
    // const [locating, setLocating] = useState(false); // Removed unused state

    const emitChange = useEffectEvent((nextValue: FormFieldValue) => {
        onChange(nextValue);
    });

    const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    const handleNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
        onChange(parseFloat(e.target.value));
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onChange({ name: file.name, size: file.size, type: file.type });
        }
    };

    // Resolver tipo condicional (typeVariants)
    const resolvedField = useMemo(() => {
        if (!field.typeVariants || field.typeVariants.length === 0) {
            return field;
        }

        // Encontrar a primeira variante cujas condições são atendidas
        for (const variant of field.typeVariants) {
            if (evaluateVisibilityRules(variant.conditions, formData)) {
                return {
                    ...field,
                    type: variant.type,
                    config: { ...field.config, ...variant.config }
                };
            }
        }

        return field;
    }, [field, formData]);

    const normalizedType = normalizeFieldType(resolvedField.type);

    // Initialize hidden field static values on mount — must be unconditional (Rules of Hooks).
    // NOTE: timestamp/defaultToNow fields are intentionally NOT initialized here.
    // They are stamped with the actual submission time in FormRenderer.handleSubmit.
    useEffect(() => {
        if (normalizedType === "hidden") {
            if (resolvedField.value !== undefined && !value) {
                emitChange(resolvedField.value);
            } else if (resolvedField.defaultValue !== undefined && !value) {
                emitChange(resolvedField.defaultValue);
            }
        }
    }, [emitChange, normalizedType, resolvedField.defaultValue, resolvedField.value, value]);

    // Auto-fill para date/time/datetime_local — deve ser incondicional (Rules of Hooks).
    // Roda apenas quando o tipo do campo corresponde e autoCurrent/defaultToNow está ativo.
    useEffect(() => {
        if (readOnly) return;
        if (!(resolvedField.autoCurrent || resolvedField.defaultToNow)) return;

        let getFormatted: (() => string) | null = null;
        if (normalizedType === 'date') {
            getFormatted = () => {
                const now = getBrasiliaNow();
                return `${now.year}-${now.month}-${now.day}`;
            };
        } else if (normalizedType === 'time') {
            getFormatted = () => {
                const now = getBrasiliaNow();
                return `${now.hours}:${now.minutes}`;
            };
        } else if (normalizedType === 'datetime_local') {
            getFormatted = () => {
                const now = getBrasiliaNow();
                return `${now.year}-${now.month}-${now.day}T${now.hours}:${now.minutes}`;
            };
        }
        if (!getFormatted) return;

        const fmt = getFormatted;
        const update = () => { if (!value) emitChange(fmt()); };
        update();
        const intervalId = setInterval(update, 60 * 1000);
        return () => clearInterval(intervalId);
    }, [emitChange, normalizedType, readOnly, resolvedField.autoCurrent, resolvedField.defaultToNow, value]);

    if (normalizedType === "hidden" || normalizedType === "timestamp") {
        return (
            <input
                type="hidden"
                id={resolvedField.id}
                name={resolvedField.id}
                value={toInputValue(value ?? resolvedField.value ?? resolvedField.defaultValue ?? "")}
            />
        );
    }

    switch (normalizedType) {
        case "presence":
        case "presence_list":
        case "presence_compact":
            return (
                <div className="space-y-2">
                    <Label>{resolvedField.label}</Label>
                    <PresenceRenderer
                        field={resolvedField}
                        value={toPresenceValue(value)}
                        onChange={(nextValue) => onChange(fromPresenceValue(nextValue))}
                        readOnly={readOnly}
                    />
                </div>
            );

        case "chips":
        case "chips_multiple":
            return (
                <div className="space-y-2">
                    <Label>{resolvedField.label}</Label>
                    <ChipsRenderer
                        field={resolvedField}
                        value={toStringArrayValue(value)}
                        onChange={(nextValue) => onChange(nextValue)}
                        readOnly={readOnly}
                        {...(resolvedField.config || {})} // Pass config
                    />
                </div>
            );

        case "text":
        case "email":
        case "tel":
        case "url":
        case "password":
        case "search":
            if (resolvedField.dataSource || resolvedField.source) {
                return (
                    <div className="space-y-2">
                        <Label htmlFor={resolvedField.id}>
                            {resolvedField.label} {resolvedField.required && <span className="text-red-500">*</span>}
                        </Label>
                        <AutocompleteRenderer
                            field={resolvedField}
                            value={toScalarSelectionValue(value)}
                            onChange={(nextValue) => onChange(nextValue)}
                            readOnly={readOnly}
                            {...(resolvedField.config || {})} // Pass config
                        />
                    </div>
                );
            }
            return (
                <div className="space-y-2">
                    <Label htmlFor={resolvedField.id}>
                        {resolvedField.label} {resolvedField.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                        id={resolvedField.id}
                        type={normalizedType === "text" ? undefined : normalizedType}
                        value={toTextValue(value)}
                        onChange={handleTextChange}
                        placeholder={resolvedField.placeholder || resolvedField.label}
                        required={resolvedField.required}
                        disabled={readOnly}
                    />
                </div>
            );

        case "number":
            return (
                <div className="space-y-2">
                    <Label htmlFor={resolvedField.id}>
                        {resolvedField.label} {resolvedField.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                        id={resolvedField.id}
                        type="number"
                        value={toInputValue(value)}
                        onChange={handleNumberChange}
                        placeholder={resolvedField.placeholder || resolvedField.label}
                        required={resolvedField.required}
                        disabled={readOnly}
                    />
                </div>
            );

        case "date":
            return (
                <div className="space-y-2">
                    <Label htmlFor={resolvedField.id}>
                        {resolvedField.label} {resolvedField.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                        id={resolvedField.id}
                        type="date"
                        value={toTextValue(value)}
                        onChange={handleTextChange}
                        required={resolvedField.required}
                        disabled={readOnly}
                    />
                </div>
            );

        case "time":
            return (
                <div className="space-y-2">
                    <Label htmlFor={resolvedField.id}>
                        {resolvedField.label} {resolvedField.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                        id={resolvedField.id}
                        type="time"
                        value={toTextValue(value)}
                        onChange={handleTextChange}
                        required={resolvedField.required}
                        disabled={readOnly}
                    />
                </div>
            );

        case "datetime_local":
            return (
                <div className="space-y-2">
                    <Label htmlFor={resolvedField.id}>
                        {resolvedField.label} {resolvedField.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                        id={resolvedField.id}
                        type="datetime-local"
                        value={toTextValue(value)}
                        onChange={handleTextChange}
                        required={resolvedField.required}
                        disabled={readOnly}
                    />
                </div>
            );

        case "select":
        case "selector_modal":
        case "selector-modal":
            return (
                <div className="space-y-2">
                    <Label htmlFor={resolvedField.id}>
                        {resolvedField.label} {resolvedField.required && <span className="text-red-500">*</span>}
                    </Label>
                    <SelectRenderer
                        field={resolvedField}
                        value={toScalarSelectionValue(value)}
                        onChange={(nextValue) => onChange(nextValue)}
                        readOnly={readOnly}
                        dependencyValue={resolvedField.dependency?.fieldId ? formData[resolvedField.dependency.fieldId] : undefined}
                        {...(resolvedField.config || {})}
                    />
                </div>
            );

        case "radio":
        case "cards_radio":
        case "cards-radio":
            return (
                <div className="space-y-2">
                    <Label>{resolvedField.label}</Label>
                    <RadioRenderer
                        field={resolvedField}
                        value={toScalarSelectionValue(value)}
                        onChange={(nextValue) => onChange(nextValue)}
                        readOnly={readOnly}
                        {...(resolvedField.config || {})}
                    />
                </div>
            );

        case "checkbox":
            return (
                <div className="space-y-4 py-2">
                    <CheckboxRenderer
                        field={resolvedField}
                        value={toCheckboxValue(value)}
                        onChange={(nextValue) => onChange(nextValue)}
                        readOnly={readOnly}
                        {...(resolvedField.config || {})}
                    />
                </div>
            );

        case "textarea":
            return (
                <div className="space-y-2">
                    <Label htmlFor={resolvedField.id}>
                        {resolvedField.label} {resolvedField.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Textarea
                        id={resolvedField.id}
                        value={toTextValue(value)}
                        onChange={(e) => onChange(e.target.value)}
                        placeholder={resolvedField.placeholder || resolvedField.label}
                        required={resolvedField.required}
                        disabled={readOnly}
                    />
                </div>
            );

        case "gallery":
            return (
                <div className="space-y-2">
                    <Label>{resolvedField.label}</Label>
                    <GalleryRenderer
                        field={resolvedField}
                        value={toGalleryItems(value)}
                        onChange={(nextValue) => onChange(fromGalleryItems(nextValue))}
                        readOnly={readOnly}
                        {...(resolvedField.config || {})}
                    />
                </div>
            );

        case "occupation":
            return (
                <div className="space-y-2">
                    <Label>{resolvedField.label}</Label>
                    <OccupationRenderer
                        field={resolvedField}
                        value={toOccupationValue(value)}
                        onChange={(nextValue) => onChange(fromOccupationValue(nextValue))}
                        readOnly={readOnly}
                        {...(resolvedField.config || {})}
                    />
                </div>
            );

        case "vistoria_checklist":
        case "dynamic_toggle_list":
        case "dynamic-toggle-list":
            return (
                <div className="space-y-2">
                    {/* Label is rendered inside the complex component header usually, but we keep it here just in case */}
                    {/* <Label>{resolvedField.label}</Label> */}
                    <VistoriaChecklistRenderer
                        field={resolvedField}
                        value={toVistoriaChecklistValue(value)}
                        onChange={(nextValue) => onChange(fromVistoriaChecklistValue(nextValue))}
                        readOnly={readOnly}
                    />
                </div>
            );

        case "photo":
        case "camera":
            return (
                <div className="space-y-4 py-2">
                    <PhotoRenderer
                        field={resolvedField}
                        value={toPhotoValue(value)}
                        onChange={(nextValue) => onChange(nextValue as FormFieldValue)}
                        readOnly={readOnly}
                    />
                </div>
            );

        case "file":
            return (
                <div className="space-y-2">
                    <Label htmlFor={resolvedField.id}>
                        {resolvedField.label} {resolvedField.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                        id={resolvedField.id}
                        type="file"
                        onChange={handleFileChange}
                        className="cursor-pointer"
                        disabled={readOnly}
                    />
                    {getNamedValue(value) && <div className="text-xs text-green-600">Arquivo selecionado: {getNamedValue(value)}</div>}
                </div>
            );

        case "gps":
        case "geolocation":
            return (
                <div className="space-y-2">
                    <Label>
                        {resolvedField.label} {resolvedField.required && <span className="text-red-500">*</span>}
                    </Label>
                    <GPSRenderer
                        field={resolvedField}
                        value={toGpsValue(value)}
                        onChange={(nextValue) => onChange(nextValue as unknown as FormFieldObjectValue)}
                        readOnly={readOnly}
                        {...(resolvedField.config || {})}
                    />
                </div>
            );

        case "repeatable_group":
        case "repeatable":
            return (
                <div className="col-span-full">
                    <RepeatableGroupRenderer
                        field={resolvedField}
                        value={toRepeatableItems(value)}
                        onChange={(nextValue) => onChange(fromRepeatableItems(nextValue))}
                        readOnly={readOnly}
                        formData={formData}
                    />
                </div>
            );

        case "group":
            // Static group - render subfields without repetition
            if (resolvedField.campos && resolvedField.campos.length > 0) {
                return (
                    <div className="col-span-full space-y-4 border rounded-lg p-4 bg-gray-50/50">
                        <h3 className="font-semibold text-lg">
                            {resolvedField.label}
                            {resolvedField.required && <span className="text-red-500 ml-1">*</span>}
                        </h3>
                        {field.description && (
                            <p className="text-sm text-muted-foreground">{field.description}</p>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {resolvedField.campos.map((subField) => {
                                const groupValue = toObjectValue(value);

                                return (
                                    <div
                                        key={subField.id}
                                        className={subField.columnSpan === 4 || subField.columnSpan === 3 ? "md:col-span-2" : ""}
                                    >
                                        <FormFieldRenderer
                                            field={subField}
                                            value={groupValue[subField.id]}
                                            onChange={(val) => {
                                                const newValue = { ...groupValue, [subField.id]: val };
                                                onChange(newValue);
                                            }}
                                            readOnly={readOnly}
                                            formData={{ ...formData, ...groupValue }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            }
            return (
                <div className="p-2 border border-yellow-200 bg-yellow-50 text-yellow-800 rounded text-sm">
                    Grupo &quot;{resolvedField.label}&quot; não possui campos definidos.
                </div>
            );

        case "entity_picker":
            return (
                <EntityPickerRenderer
                    field={resolvedField}
                    value={String(toInputValue(value ?? resolvedField.value ?? resolvedField.defaultValue ?? ""))}
                    onChange={(val) => onChange(val)}
                    readOnly={readOnly}
                />
            );

        default:
            return (
                <div className="p-2 border border-yellow-200 bg-yellow-50 text-yellow-800 rounded text-sm">
                    Tipo de campo desconhecido: {resolvedField.type}
                </div>
            );
    }
}
