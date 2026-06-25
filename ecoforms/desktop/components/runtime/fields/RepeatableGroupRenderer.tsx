"use client";

import { useCallback, useMemo } from "react";
import { FormField } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
import { FormFieldRenderer } from "../FormFieldRenderer";

export type RepeatableFieldValue = string | number | boolean | null | undefined | File | RepeatableFieldValue[] | { [key: string]: RepeatableFieldValue };
export type RepeatableItem = Record<string, RepeatableFieldValue>;

interface RepeatableGroupRendererProps {
    field: FormField;
    value: RepeatableItem[];
    onChange: (value: RepeatableItem[]) => void;
    readOnly?: boolean;
    formData?: Record<string, unknown>;
}

export function RepeatableGroupRenderer({
    field,
    value,
    onChange,
    readOnly = false,
    formData = {},
}: RepeatableGroupRendererProps) {
    const items = useMemo(() => {
        return Array.isArray(value) ? value : [];
    }, [value]);

    const subFields = useMemo(() => {
        return field.campos || [];
    }, [field.campos]);

    const config = useMemo(() => {
        return {
            minItems: 0,
            maxItems: Infinity,
            addButtonLabel: "Adicionar Item",
            removeButtonLabel: "Remover",
            itemLabel: "Item",
            ...field.config,
        };
    }, [field.config]);

    const canAdd = items.length < config.maxItems;
    const canRemove = items.length > config.minItems;

    const handleAddItem = useCallback(() => {
        if (!canAdd) return;
        const newItem: RepeatableItem = {};
        // Initialize with default values from subfields
        subFields.forEach((subField) => {
            if (subField.defaultValue !== undefined) {
                newItem[subField.id] = subField.defaultValue;
            }
        });
        onChange([...items, newItem]);
    }, [items, subFields, canAdd, onChange]);

    const handleRemoveItem = useCallback((index: number) => {
        if (!canRemove) return;
        const newItems = [...items];
        newItems.splice(index, 1);
        onChange(newItems);
    }, [items, canRemove, onChange]);

    const handleSubFieldChange = useCallback((index: number, subFieldId: string, subValue: RepeatableFieldValue) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            [subFieldId]: subValue,
        };
        onChange(newItems);
    }, [items, onChange]);

    if (subFields.length === 0) {
        return (
            <div className="p-4 border border-yellow-200 bg-yellow-50 text-yellow-800 rounded text-sm">
                Grupo repetível &quot;{field.label}&quot; não possui campos definidos.
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                </h3>
                {!readOnly && canAdd && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddItem}
                        className="flex items-center gap-1"
                    >
                        <Plus className="h-4 w-4" />
                        {config.addButtonLabel}
                    </Button>
                )}
            </div>

            {field.description && (
                <p className="text-sm text-muted-foreground">{field.description}</p>
            )}

            <div className="space-y-4">
                {items.length === 0 && !readOnly && (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-gray-200 rounded-lg">
                        Nenhum item adicionado. Clique em &quot;{config.addButtonLabel}&quot; para começar.
                    </div>
                )}

                {items.map((item, index) => (
                    <Card key={index} className="relative">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium">
                                    {config.itemLabel} {index + 1}
                                </CardTitle>
                                {!readOnly && canRemove && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveItem(index)}
                                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {subFields.map((subField) => (
                                    <div
                                        key={subField.id}
                                        className={subField.columnSpan === 4 || subField.columnSpan === 3 ? "md:col-span-2" : ""}
                                    >
                                        <FormFieldRenderer
                                            field={subField}
                                            value={item?.[subField.id]}
                                            onChange={(val) => handleSubFieldChange(index, subField.id, val)}
                                            readOnly={readOnly}
                                            formData={{ ...formData, ...item }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {!readOnly && canAdd && items.length > 0 && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddItem}
                    className="w-full flex items-center justify-center gap-1"
                >
                    <Plus className="h-4 w-4" />
                    {config.addButtonLabel}
                </Button>
            )}
        </div>
    );
}
