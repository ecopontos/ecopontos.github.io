"use client";

import { useState, useCallback } from "react";
import { FormField, VisibilityRule, VisibilityOperator } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Plus, Trash2, GripVertical } from "lucide-react";

function toInputText(value: VisibilityRule["value"]): string {
    return typeof value === "string" || typeof value === "number"
        ? String(value)
        : "";
}

function toInputValues(values: VisibilityRule["values"]): string {
    return (values || [])
        .map((value) => (typeof value === "string" || typeof value === "number" ? String(value) : ""))
        .filter((value) => value !== "")
        .join(", ");
}

interface VisibilityRulesEditorProps {
    fields: FormField[];
    currentFieldIndex: number;
    rules?: VisibilityRule[];
    onChange: (rules: VisibilityRule[] | undefined) => void;
    label?: string;
    description?: string;
    descriptionOff?: string;
    sectionLabel?: string;
}

const OPERATORS: { value: VisibilityOperator; label: string }[] = [
    { value: "eq", label: "igual a" },
    { value: "neq", label: "diferente de" },
    { value: "gt", label: "maior que" },
    { value: "gte", label: "maior ou igual a" },
    { value: "lt", label: "menor que" },
    { value: "lte", label: "menor ou igual a" },
    { value: "contains", label: "contém" },
    { value: "startsWith", label: "começa com" },
    { value: "endsWith", label: "termina com" },
    { value: "in", label: "está em" },
    { value: "notIn", label: "não está em" },
    { value: "empty", label: "está vazio" },
    { value: "notEmpty", label: "não está vazio" },
];

export function VisibilityRulesEditor({
    fields,
    currentFieldIndex,
    rules,
    onChange,
    label = "Condição de Visibilidade",
    description = "Campo só aparece quando as condições são atendidas",
    descriptionOff = "Campo sempre visível",
    sectionLabel = "Mostrar quando:",
}: VisibilityRulesEditorProps) {
    const [enabled, setEnabled] = useState(!!rules && rules.length > 0);

    const currentField = fields[currentFieldIndex];

    // Filtrar campos disponíveis (excluir o campo atual)
    const availableFields = fields.filter((_, idx) => idx !== currentFieldIndex);

    const handleToggleEnabled = (checked: boolean) => {
        setEnabled(checked);
        if (!checked) {
            onChange(undefined);
        } else if (!rules || rules.length === 0) {
            // Adicionar primeira regra padrão
            onChange([
                {
                    fieldId: availableFields[0]?.id || "",
                    operator: "eq",
                    value: "",
                },
            ]);
        }
    };

    const addRule = () => {
        const newRule: VisibilityRule = {
            fieldId: availableFields[0]?.id || "",
            operator: "eq",
            value: "",
            logic: "AND",
        };
        onChange([...(rules || []), newRule]);
    };

    const removeRule = (index: number) => {
        const newRules = [...(rules || [])];
        newRules.splice(index, 1);
        onChange(newRules.length > 0 ? newRules : undefined);
        if (newRules.length === 0) {
            setEnabled(false);
        }
    };

    const updateRule = (index: number, updates: Partial<VisibilityRule>) => {
        const newRules = [...(rules || [])];
        newRules[index] = { ...newRules[index], ...updates };
        onChange(newRules);
    };

    const needsValue = (operator: VisibilityOperator): boolean => {
        return !["empty", "notEmpty"].includes(operator);
    };

    const needsValues = (operator: VisibilityOperator): boolean => {
        return ["in", "notIn"].includes(operator);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-2">
                <Switch
                    id={`visibility-enabled-${currentFieldIndex}`}
                    checked={enabled}
                    onCheckedChange={handleToggleEnabled}
                />
                <div className="grid gap-1.5 leading-none">
                    <Label
                        htmlFor={`visibility-enabled-${currentFieldIndex}`}
                        className="text-sm font-medium flex items-center gap-2"
                    >
                        {enabled ? (
                            <Eye className="h-4 w-4 text-primary" />
                        ) : (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                        {label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                        {enabled ? description : descriptionOff}
                    </p>
                </div>
            </div>

            {enabled && rules && rules.length > 0 && (
                <Card className="border-dashed bg-muted/30">
                    <CardContent className="p-4 space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">
                            {sectionLabel}
                        </p>

                        {rules.map((rule, index) => (
                            <div key={index} className="space-y-2">
                                {index > 0 && (
                                    <div className="flex justify-center">
                                        <Select
                                            value={rule.logic || "AND"}
                                            onValueChange={(val) =>
                                                updateRule(index, {
                                                    logic: val as "AND" | "OR",
                                                })
                                            }
                                        >
                                            <SelectTrigger className="w-20 h-7 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="AND">
                                                    E
                                                </SelectItem>
                                                <SelectItem value="OR">
                                                    OU
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div className="flex items-start gap-2">
                                    <div className="flex-1 grid grid-cols-12 gap-2">
                                        {/* Campo de referência */}
                                        <div className="col-span-4">
                                            <Select
                                                value={rule.fieldId}
                                                onValueChange={(val) =>
                                                    updateRule(index, {
                                                        fieldId: val,
                                                    })
                                                }
                                            >
                                                <SelectTrigger className="h-9 text-xs">
                                                    <SelectValue placeholder="Campo..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableFields.map(
                                                        (field) => (
                                                            <SelectItem
                                                                key={field.id}
                                                                value={field.id}
                                                            >
                                                                {field.label ||
                                                                    field.id}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Operador */}
                                        <div className="col-span-3">
                                            <Select
                                                value={rule.operator}
                                                onValueChange={(val) =>
                                                    updateRule(index, {
                                                        operator:
                                                            val as VisibilityOperator,
                                                    })
                                                }
                                            >
                                                <SelectTrigger className="h-9 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {OPERATORS.map((op) => (
                                                        <SelectItem
                                                            key={op.value}
                                                            value={op.value}
                                                        >
                                                            {op.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Valor(es) */}
                                        {needsValue(rule.operator) && (
                                            <div className="col-span-3">
                                                {needsValues(rule.operator) ? (
                                                    <Input
                                                        value={toInputValues(rule.values)}
                                                        onChange={(e) =>
                                                            updateRule(index, {
                                                                values: e.target.value
                                                                    .split(","
                                                                    )
                                                                    .map((s) =>
                                                                        s.trim()
                                                                    )
                                                                    .filter(
                                                                        (s) =>
                                                                            s !==
                                                                            ""
                                                                    ),
                                                            })
                                                        }
                                                        placeholder="val1, val2, val3"
                                                        className="h-9 text-xs"
                                                    />
                                                ) : (
                                                    <Input
                                                        value={toInputText(rule.value)}
                                                        onChange={(e) =>
                                                            updateRule(index, {
                                                                value: e.target
                                                                    .value,
                                                            })
                                                        }
                                                        placeholder="Valor..."
                                                        className="h-9 text-xs"
                                                    />
                                                )}
                                            </div>
                                        )}

                                        {/* Negate toggle */}
                                        <div 
                                            className="col-span-2 flex items-center justify-center gap-1.5 bg-muted/30 rounded-md px-1.5 border border-dashed border-muted-foreground/30"
                                            title="Se ativado, inverte as regras acima (NÃO)"
                                        >
                                            <Switch
                                                id={`negate-rule-${index}`}
                                                checked={rule.negate || false}
                                                onCheckedChange={(checked) =>
                                                    updateRule(index, {
                                                        negate: checked,
                                                    })
                                                }
                                                className="scale-75"
                                            />
                                            <Label 
                                                htmlFor={`negate-rule-${index}`}
                                                className="text-[10px] cursor-pointer text-muted-foreground font-semibold"
                                            >
                                                Inverter
                                            </Label>
                                        </div>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 text-destructive shrink-0"
                                        onClick={() => removeRule(index)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}

                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2"
                            onClick={addRule}
                            disabled={availableFields.length === 0}
                        >
                            <Plus className="h-3 w-3 mr-2" />
                            Adicionar Condição
                        </Button>

                        {availableFields.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center">
                                Adicione mais campos ao formulário para criar
                                condições.
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export default VisibilityRulesEditor;
