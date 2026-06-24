"use client";

import { FormField } from "@/types";
import { FormFieldRenderer } from "./FormFieldRenderer";
import type { FormFieldObjectValue, FormFieldValue } from "./FormFieldRenderer";
import { Card, CardContent } from "@/components/ui/card";

interface FormViewerDefinition {
    titulo?: string;
    descricao?: string;
    campos: FormField[];
}

interface FormViewerProps {
    formDefinition: FormViewerDefinition | null | undefined;
    formData: Record<string, FormFieldValue>;
    readOnly?: boolean;
    onChange?: (fieldId: string, value: FormFieldValue) => void;
}

export function FormViewer({
    formDefinition,
    formData,
    readOnly = true,
    onChange
}: FormViewerProps) {
    if (!formDefinition || !formDefinition.campos) {
        return (
            <div className="text-center p-6 text-gray-500">
                Definição do formulário não encontrada
            </div>
        );
    }

    const handleFieldChange = (fieldId: string, value: FormFieldValue) => {
        if (onChange) {
            onChange(fieldId, value);
        }
    };

    const isGroupField = (field: FormField) => {
        const fieldType = String(field.type || "").trim().toLowerCase().replace(/-/g, "_");
        return fieldType === "group" || fieldType === "repeatable_group" || fieldType === "repeatable";
    };

    return (
        <div className="space-y-4">
            {formDefinition.titulo && (
                <div>
                    <h3 className="text-lg font-semibold">{formDefinition.titulo}</h3>
                    {formDefinition.descricao && (
                        <p className="text-sm text-gray-600 mt-1">{formDefinition.descricao}</p>
                    )}
                </div>
            )}

            <div className="space-y-4">
                {formDefinition.campos.map((field: FormField) => {
                    // Skip hidden/timestamp fields in view mode
                    if (field.type === "hidden" || field.type === "timestamp") {
                        return null;
                    }

                    const fieldContent = (
                        <FormFieldRenderer
                            field={field}
                            value={formData[field.id]}
                            onChange={(value) => handleFieldChange(field.id, value)}
                            readOnly={readOnly}
                            formData={formData}
                        />
                    );

                    if (isGroupField(field)) {
                        return (
                            <div key={field.id} className="space-y-4">
                                {fieldContent}
                            </div>
                        );
                    }

                    return (
                        <Card key={field.id} className="border-gray-200">
                            <CardContent className="pt-6">
                                {fieldContent}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
