import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FieldSchema } from "@/src/lib/registry-schema";
import type { FormFieldValue } from "@/components/runtime/FormFieldRenderer";

type DynamicFormValues = Record<string, FormFieldValue>;

function toTextInputValue(value: FormFieldValue | undefined): string {
    return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function toBooleanValue(value: FormFieldValue | undefined): boolean {
    return value === true;
}

interface DynamicFormEditorProps {
    schema: FieldSchema[];
    values: DynamicFormValues;
    onChange: (values: DynamicFormValues) => void;
}

export function DynamicFormEditor({ schema, values, onChange }: DynamicFormEditorProps) {
    const updateField = (key: string, val: FormFieldValue) => {
        onChange({ ...values, [key]: val });
    };

    if (schema.length === 0) {
        return (
            <div className="text-center py-8 text-sm text-gray-400 italic">
                Nenhum campo detectado. Use o modo JSON para editar o conteúdo diretamente.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {schema.map((field) => {
                const fullWidth = field.type === "textarea";

                return (
                    <div key={field.key} className={`space-y-1.5 ${fullWidth ? "col-span-2" : ""}`}>
                        <Label htmlFor={`field-${field.key}`} className="text-xs font-medium text-gray-600">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-0.5">*</span>}
                        </Label>

                        {field.type === "boolean" && (
                            <div className="flex items-center h-9">
                                <Switch
                                    id={`field-${field.key}`}
                                    checked={toBooleanValue(values[field.key])}
                                    onCheckedChange={(checked) => updateField(field.key, checked)}
                                />
                                <span className="ml-2 text-sm text-gray-500">
                                    {toBooleanValue(values[field.key]) ? "Sim" : "Não"}
                                </span>
                            </div>
                        )}

                        {field.type === "number" && (
                            <Input
                                id={`field-${field.key}`}
                                type="number"
                                value={toTextInputValue(values[field.key])}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    updateField(field.key, v === "" ? "" : Number(v));
                                }}
                                className="h-9"
                            />
                        )}

                        {field.type === "string" && (
                            <Input
                                id={`field-${field.key}`}
                                value={toTextInputValue(values[field.key])}
                                onChange={(e) => updateField(field.key, e.target.value)}
                                className="h-9"
                            />
                        )}

                        {field.type === "textarea" && (
                            <Textarea
                                id={`field-${field.key}`}
                                value={toTextInputValue(values[field.key])}
                                onChange={(e) => updateField(field.key, e.target.value)}
                                className="min-h-[80px] text-sm resize-none"
                            />
                        )}

                        {field.type === "select" && field.options && (
                            <Select
                                value={toTextInputValue(values[field.key])}
                                onValueChange={(v) => updateField(field.key, v)}
                            >
                                <SelectTrigger className="h-9" id={`field-${field.key}`}>
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {field.options.map((opt) => (
                                        <SelectItem key={opt} value={opt}>
                                            {opt}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
