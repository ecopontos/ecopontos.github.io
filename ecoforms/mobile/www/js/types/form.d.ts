/**
 * Type definitions for form fields
 */

export interface FormField {
    id: string;
    type: string;
    label: string;
    required?: boolean;
    options?: FieldOption[];
    items?: any[];
    rawData?: any[];
    dataSource?: string;
    source?: string; // Legacy alias for dataSource
    autoCurrent?: boolean;
    defaultToNow?: boolean;
    value?: any;
    participants?: any[];
    config?: any;
    // Field-specific properties
    valueField?: string;
    labelField?: string;
    optionValue?: string;
    optionLabel?: string;
    multiple?: boolean;
    showEmptyOption?: boolean;
    emptyOptionLabel?: string;
    emptyOptionValue?: string;
}

export interface FieldOption {
    value: string | number;
    label: string;
    icon?: string;
    emoji?: string;
    description?: string;
    descricao?: string;
}

export interface FormContent {
    id: string;
    titulo: string;
    title?: string; // Legacy alias
    campos: FormField[];
}

export interface FormData {
    [fieldId: string]: any;
}

export interface FormErrors {
    [fieldId: string]: string;
}
