"use client";

import { useCallback, useMemo } from "react";
import { VisibilityRule, FormField } from "@/types";

type VisibilityFormData = Record<string, unknown>;

/**
 * Avalia uma única condição baseada no valor do campo e operador
 */
function evaluateCondition(fieldValue: unknown, rule: VisibilityRule): boolean {
    const { operator, value, values } = rule;

    // Normalizar valores para comparação
    const normalizedFieldValue = fieldValue === undefined || fieldValue === null ? "" : fieldValue;

    switch (operator) {
        case "eq":
            return String(normalizedFieldValue) === String(value);

        case "neq":
            return String(normalizedFieldValue) !== String(value);

        case "gt":
            return Number(normalizedFieldValue) > Number(value);

        case "gte":
            return Number(normalizedFieldValue) >= Number(value);

        case "lt":
            return Number(normalizedFieldValue) < Number(value);

        case "lte":
            return Number(normalizedFieldValue) <= Number(value);

        case "contains":
            return String(normalizedFieldValue).toLowerCase().includes(String(value).toLowerCase());

        case "startsWith":
            return String(normalizedFieldValue).toLowerCase().startsWith(String(value).toLowerCase());

        case "endsWith":
            return String(normalizedFieldValue).toLowerCase().endsWith(String(value).toLowerCase());

        case "in":
            if (!values || values.length === 0) return false;
            return values.some((v) => String(normalizedFieldValue) === String(v));

        case "notIn":
            if (!values || values.length === 0) return true;
            return !values.some((v) => String(normalizedFieldValue) === String(v));

        case "empty":
            return (
                normalizedFieldValue === "" ||
                normalizedFieldValue === null ||
                normalizedFieldValue === undefined ||
                (Array.isArray(normalizedFieldValue) && normalizedFieldValue.length === 0)
            );

        case "notEmpty":
            return (
                normalizedFieldValue !== "" &&
                normalizedFieldValue !== null &&
                normalizedFieldValue !== undefined &&
                (!Array.isArray(normalizedFieldValue) || normalizedFieldValue.length > 0)
            );

        default:
            return true;
    }
}

/**
 * Avalia um array de regras de visibilidade contra os dados do formulário
 * @param rules - Array de regras de visibilidade
 * @param formData - Dados atuais do formulário
 * @returns true se todas as regras forem atendidas (ou se não houver regras)
 */
export function evaluateVisibilityRules(
    rules: VisibilityRule[] | undefined,
    formData: VisibilityFormData
): boolean {
    if (!rules || rules.length === 0) {
        return true; // Sem regras = sempre visível/habilitado
    }

    return rules.reduce((result, rule, index) => {
        const fieldValue = formData[rule.fieldId];
        let conditionMet = evaluateCondition(fieldValue, rule);

        // Aplicar negação se necessário
        if (rule.negate) {
            conditionMet = !conditionMet;
        }

        // Primeira regra retorna diretamente seu resultado
        if (index === 0) {
            return conditionMet;
        }

        // Regras subsequentes combinam com a lógica anterior
        const logic = rule.logic || "AND";
        return logic === "AND" ? result && conditionMet : result || conditionMet;
    }, true);
}

/**
 * Hook para avaliar visibilidade de campos de formulário
 * @param formData - Dados atuais do formulário
 * @returns Funções utilitárias para avaliar visibilidade
 */
export function useVisibilityEvaluator(formData: VisibilityFormData) {
    /**
     * Verifica se um campo deve ser visível baseado em suas regras
     */
    const isFieldVisible = useCallback(
        (field: FormField): boolean => {
            return evaluateVisibilityRules(field.visibility, formData);
        },
        [formData]
    );

    /**
     * Verifica se um campo deve estar habilitado baseado em suas regras
     */
    const isFieldEnabled = useCallback(
        (field: FormField): boolean => {
            return evaluateVisibilityRules(field.enabled, formData);
        },
        [formData]
    );

    /**
     * Resolve o tipo de campo considerando variantes condicionais
     */
    const resolveFieldType = useCallback(
        (field: FormField): { type: string; config?: Record<string, unknown> } => {
            if (!field.typeVariants || field.typeVariants.length === 0) {
                return { type: field.type, config: field.config };
            }

            // Encontrar a primeira variante cujas condições são atendidas
            for (const variant of field.typeVariants) {
                if (evaluateVisibilityRules(variant.conditions, formData)) {
                    return { type: variant.type, config: { ...field.config, ...variant.config } };
                }
            }

            // Nenhuma variante atendida, retornar tipo padrão
            return { type: field.type, config: field.config };
        },
        [formData]
    );

    /**
     * Filtra uma lista de campos retornando apenas os visíveis
     */
    const visibleFields = useCallback(
        (fields: FormField[]): FormField[] => {
            return fields.filter(isFieldVisible);
        },
        [isFieldVisible]
    );

    return {
        isFieldVisible,
        isFieldEnabled,
        resolveFieldType,
        visibleFields,
        evaluateRules: (rules?: VisibilityRule[]) => evaluateVisibilityRules(rules, formData),
    };
}

/**
 * Hook para obter apenas os campos visíveis de um formulário
 * Útil para evitar re-renderizações desnecessárias
 */
export function useVisibleFields(fields: FormField[], formData: VisibilityFormData): FormField[] {
    return useMemo(() => {
        if (!fields || fields.length === 0) return [];
        return fields.filter((field) => evaluateVisibilityRules(field.visibility, formData));
    }, [fields, formData]);
}

export default useVisibilityEvaluator;
