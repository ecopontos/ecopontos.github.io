import { useMemo } from 'react';
import { FormField } from '@/types';
import type { FormFieldValue } from '@/components/runtime/FormFieldRenderer';

type SubmissionEnvelope = {
    campos?: Record<string, FormFieldValue>;
    form_data?: Record<string, FormFieldValue>;
    [key: string]: unknown;
};

export function useSubmissionData(submissionDados: unknown, formFields: FormField[] = []) {
    return useMemo(() => {
        if (!submissionDados) return {};

        // 1. Parse string data if necessary
        const data: SubmissionEnvelope = typeof submissionDados === 'string'
            ? JSON.parse(submissionDados) as SubmissionEnvelope
            : (submissionDados as SubmissionEnvelope);

        // 2. Identify the root data object
        // New format: { contexto: {...}, campos: {...}, arquivos: {...} }
        // Analysis format often sees: { form_data: {...} }
        // Legacy format: raw object
        // We prioritize 'campos' (our fixed ViewSubmission logic) then 'form_data' (Analysis logic) then root
        const formData: Record<string, unknown> = data.campos || data.form_data || data;

        const normalizedData: Record<string, FormFieldValue> = {};

        // Helper to find value with fallbacks
        const findValue = (id: string): FormFieldValue | undefined => {
            // Direct match
            if (formData[id] !== undefined) return formData[id] as FormFieldValue;

            // Aliases
            const aliases: Record<string, string[]> = {
                'rejeito': ['vidros_2'],
                'educador_ambiental': ['nome_galpao', 'participantes_presentes']
            };
            const possibleAliases = aliases[id] || [];
            for (const alias of possibleAliases) {
                if (formData[alias] !== undefined) return formData[alias] as FormFieldValue;
            }

            // Legacy field_XXXX mappings
            const fieldKeys = Object.keys(formData).filter(k => k.startsWith('field_')).sort();
            if (fieldKeys.length > 0) {
                const legacyMap: Record<string, number> = {
                    'estabelecimento': 0,
                    'organicos': 1,
                    'embalagens': 2,
                    'vidros': 3,
                    'rejeito': 4,
                    'bombonas_na_caixa_1': 5,
                    'bombonas_na_caixa_2': 6,
                    'copos_retornaveis': 7,
                    'dificuldades': 8,
                    'data_de_referencia': 9
                };
                const legacyIndex = legacyMap[id];
                if (legacyIndex !== undefined && fieldKeys[legacyIndex]) {
                    return formData[fieldKeys[legacyIndex]] as FormFieldValue;
                }
            }

            return undefined;
        };

        // 3. Map all known fields
        formFields.forEach(field => {
            const val = findValue(field.id);
            if (val !== undefined) {
                normalizedData[field.id] = val;
            }
        });

        // 4. Preserve any other keys that might be in formData but not in fields (optional, but good for custom fields)
        Object.keys(formData).forEach(key => {
            if (normalizedData[key] === undefined) {
                normalizedData[key] = formData[key] as FormFieldValue;
            }
        });

        return normalizedData;
    }, [submissionDados, formFields]);
}
