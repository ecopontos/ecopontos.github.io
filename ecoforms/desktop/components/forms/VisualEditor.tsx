"use client";

import { useState } from "react";
import { FormField } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, ArrowUp, ArrowDown, GripVertical, ChevronDown } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { FormLayoutConfig } from "./FormLayoutConfig";
import { FieldPropertiesPanel } from "./FieldPropertiesPanel";

interface VisualEditorProps {
    fields: FormField[];
    onChange: (fields: FormField[]) => void;
    selectedIndex?: number | null;
    onSelectField?: (index: number | null) => void;
    formLayout?: { columns?: 1 | 2 | 3 | 4; gap?: 'sm' | 'md' | 'lg' };
    onFormLayoutChange?: (layout: { columns?: 1 | 2 | 3 | 4; gap?: 'sm' | 'md' | 'lg' }) => void;
}

export function VisualEditor({ fields, onChange, selectedIndex, onSelectField, formLayout, onFormLayoutChange }: VisualEditorProps) {
    const [collapsedFields, setCollapsedFields] = useState<Set<string>>(new Set());

    const toggleCollapse = (fieldId: string) => {
        setCollapsedFields(prev => {
            const next = new Set(prev);
            if (next.has(fieldId)) next.delete(fieldId);
            else next.add(fieldId);
            return next;
        });
    };

    const removeField = (index: number) => {
        const newFields = [...(fields || [])];
        newFields.splice(index, 1);
        onChange(newFields);
        if (onSelectField && selectedIndex === index) {
            onSelectField(null);
        }
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
        if (!fields) return;
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === fields.length - 1) return;

        const newFields = [...fields];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [newFields[index], newFields[swapIndex]] = [newFields[swapIndex], newFields[index]];
        onChange(newFields);

        if (onSelectField && selectedIndex === index) {
            onSelectField(swapIndex);
        }
    };

    const generateSlug = (text: string): string => {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9\s_-]/g, '')
            .trim()
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    };

    const updateField = (index: number, updates: Partial<FormField>) => {
        const newFields = [...(fields || [])];

        if (updates.label !== undefined && !newFields[index].id) {
            const slug = generateSlug(updates.label);
            if (slug) {
                const existingIds = newFields
                    .map((f, i) => i !== index ? f.id : null)
                    .filter(Boolean) as string[];

                let finalSlug = slug;
                let counter = 2;
                while (existingIds.includes(finalSlug)) {
                    finalSlug = `${slug}_${counter}`;
                    counter++;
                }
                updates.id = finalSlug;
            }
        }

        newFields[index] = { ...newFields[index], ...updates };
        onChange(newFields);
    };

    return (
        <div className="space-y-3">
            {onFormLayoutChange && (
                <FormLayoutConfig
                    formLayout={formLayout}
                    onFormLayoutChange={onFormLayoutChange}
                />
            )}

            {(fields || []).map((field, index) => {
                const isCollapsed = collapsedFields.has(field.id);
                return (
                    <Card
                        key={field.id}
                        className={cn(
                            "relative group transition-all cursor-pointer hover:shadow-md border-2",
                            selectedIndex === index
                                ? "border-primary shadow-sm"
                                : "border-transparent hover:border-muted-foreground/20"
                        )}
                        onClick={() => onSelectField?.(index)}
                    >
                        <CardContent className="p-4">
                            <div className="flex gap-2 items-start">
                                <div className="flex items-center pt-2">
                                    <GripVertical className="h-5 w-5 text-muted-foreground/40" />
                                </div>

                                <div className="flex-1">
                                    {isCollapsed && (
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-sm">{field.label}</p>
                                                    {field.type === 'hidden' && (
                                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                                            Oculto
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">Tipo: {field.type} · ID: {field.id}</p>
                                            </div>
                                        </div>
                                    )}

                                    {!isCollapsed && (
                                        <FieldPropertiesPanel
                                            field={field}
                                            index={index}
                                            allFields={fields || []}
                                            onUpdate={updateField}
                                        />
                                    )}
                                </div>

                                <div className="flex gap-0.5 items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => { e.stopPropagation(); toggleCollapse(field.id); }}
                                        title={isCollapsed ? "Expandir" : "Colapsar"}
                                    >
                                        <ChevronDown className={cn(
                                            "h-4 w-4 transition-transform",
                                            isCollapsed ? "-rotate-90" : "rotate-0"
                                        )} />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => { e.stopPropagation(); moveField(index, 'up'); }}
                                        disabled={index === 0}
                                        title="Mover para cima"
                                    >
                                        <ArrowUp className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => { e.stopPropagation(); moveField(index, 'down'); }}
                                        disabled={index === (fields || []).length - 1}
                                        title="Mover para baixo"
                                    >
                                        <ArrowDown className="h-3 w-3" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={(e) => { e.stopPropagation(); removeField(index); }}
                                        title="Remover campo"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
