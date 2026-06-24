"use client";

import { FormField } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/src/lib/utils";
import type { CheckedState } from "@radix-ui/react-checkbox";

interface CheckboxRendererProps {
    field: FormField;
    value: boolean | string | number | null | undefined;
    onChange: (value: CheckedState) => void;
    readOnly?: boolean;
}

export function CheckboxRenderer({ field, value, onChange, readOnly = false }: CheckboxRendererProps) {
    return (
        <div className="flex items-center space-x-2">
            <Checkbox
                id={field.id}
                checked={!!value}
                onCheckedChange={(checked) => onChange(checked)}
                disabled={readOnly}
            />
            <Label htmlFor={field.id} className={cn("font-normal", !readOnly && "cursor-pointer", readOnly && "opacity-70")}>
                {field.label} {/* Often checkbox label is separate, or we ignore the top label? Usually checkbox has side label */}
                {/* Logic: if FormFieldRenderer renders top label, we might not need this, OR we render description here */}
                {/* For standard checkbox field, the label is usually next to the box */}
            </Label>
        </div>
    );
}
