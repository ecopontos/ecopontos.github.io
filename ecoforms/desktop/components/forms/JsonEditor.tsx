"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface JsonEditorProps {
    value: string;
    onChange: (value: string) => void;
}

export function JsonEditor({ value, onChange }: JsonEditorProps) {
    const [localValue, setLocalValue] = useState(value);
    const [error, setError] = useState<string | null>(null);
    const [isValid, setIsValid] = useState(true);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newVal = e.target.value;
        setLocalValue(newVal);

        try {
            const parsed = JSON.parse(newVal);
            if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.campos)) {
                setError("JSON inválido: esperado { campos: [...] }");
                setIsValid(false);
                return;
            }
            setError(null);
            setIsValid(true);
            onChange(newVal);
        } catch (e: any) {
            setError(e.message);
            setIsValid(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">JSON Schema</h3>
                {isValid ? (
                    <div className="flex items-center text-green-600 text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Válido
                    </div>
                ) : (
                    <div className="flex items-center text-red-600 text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" /> Inválido
                    </div>
                )}
            </div>

            <Textarea
                value={localValue}
                onChange={handleChange}
                className="font-mono text-xs min-h-[500px]"
                placeholder="{ ... }"
            />

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>JSON inválido</AlertTitle>
                    <AlertDescription>
                        {error}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
}
