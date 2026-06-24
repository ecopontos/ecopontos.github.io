/**
 * FieldFactory v2 - Suporta campos modernizados
 * Mantém compatibilidade com campos legados
 */

// Import campos v2
import SelectFieldV2 from './types/SelectField.v2.js';
import RadioFieldV2 from './types/RadioField.v2.js';
import CheckboxFieldV2 from './types/CheckboxField.v2.js';
import TextInputFieldV2 from './types/TextInputField.v2.js';
import NumberInputFieldV2 from './types/NumberInputField.v2.js';
import DateFieldV2 from './types/DateField.v2.js';
import TimeFieldV2 from './types/TimeField.v2.js';
import TextareaFieldV2 from './types/TextareaField.v2.js';
import ChipsFieldV2 from './types/ChipsField.v2.js';
import GPSFieldV2 from './types/GPSField.v2.js';
import CameraFieldV2 from './types/CameraField.v2.js';
import GalleryFieldV2 from './types/GalleryField.v2.js';
import GroupField from './types/GroupField.js';
import RepeatableGroupField from './types/RepeatableGroupField.js';

// Import campos legados (fallback)
import SelectField from './types/SelectField.js';
import RadioField from './types/RadioField.js';
import CheckboxField from './types/CheckboxField.js';
// TODO: Import legacy versions when available

/**
 * Mapeamento de tipos para classes de campos v2
 */
const FIELD_CLASSES_V2 = {
    // Basic inputs
    'select': SelectFieldV2,
    'radio': RadioFieldV2,
    'checkbox': CheckboxFieldV2,
    'text': TextInputFieldV2,
    'number': NumberInputFieldV2,
    'date': DateFieldV2,
    'time': TimeFieldV2,
    'textarea': TextareaFieldV2,

    // Complex fields
    'chips': ChipsFieldV2,
    'gps': GPSFieldV2,
    'camera': CameraFieldV2,
    'photo': CameraFieldV2,  // Alias
    'gallery': GalleryFieldV2,

    // Group fields
    'repeatable_group': RepeatableGroupField,
    'repeatable': RepeatableGroupField,
    'group': GroupField,
};

/**
 * Mapeamento de tipos para classes de campos legacy
 */
const FIELD_CLASSES_LEGACY = {
    'select': SelectField,
    'radio': RadioField,
    'checkbox': CheckboxField,
    // Legacy text/number/etc will fallback to v2 if not available
};

/**
 * Factory para criar campos
 * Suporta versões v2 (modernizadas) e legacy (compatibilidade)
 */
export class FieldFactoryV2 {
    /**
     * Cria uma instância de campo
     * @param {import('../types/form').FormField} config - Configuração do campo
     * @param {boolean} useV2 - Se true, usa versão modernizada (default: true)
     * @returns {BaseField}
     */
    static create(config, useV2 = true) {
        const fieldType = (config.type || '').toLowerCase();

        // Escolher mapeamento baseado na versão
        const classMap = useV2 ? FIELD_CLASSES_V2 : FIELD_CLASSES_LEGACY;

        // Obter classe do campo
        const FieldClass = classMap[fieldType];

        if (!FieldClass) {
            console.warn(`Campo tipo '${fieldType}' não encontrado, usando fallback legacy`);
            const LegacyClass = FIELD_CLASSES_LEGACY[fieldType];

            if (!LegacyClass) {
                throw new Error(`Tipo de campo desconhecido: ${fieldType}`);
            }

            return new LegacyClass(config);
        }

        return new FieldClass(config);
    }

    /**
     * Obtém a classe de um campo sem instanciar
     * @param {string} fieldType
     * @param {boolean} useV2
     * @returns {typeof BaseField}
     */
    static getClass(fieldType, useV2 = true) {
        const type = fieldType.toLowerCase();
        const classMap = useV2 ? FIELD_CLASSES_V2 : FIELD_CLASSES_LEGACY;
        return classMap[type] || FIELD_CLASSES_LEGACY[type];
    }

    /**
     * Verifica se um tipo de campo tem versão v2
     * @param {string} fieldType
     * @returns {boolean}
     */
    static hasV2(fieldType) {
        const type = fieldType.toLowerCase();
        return !!FIELD_CLASSES_V2[type];
    }

    /**
     * Lista todos os tipos de campos disponíveis
     * @returns {{v2: string[], legacy: string[]}}
     */
    static getAvailableTypes() {
        return {
            v2: Object.keys(FIELD_CLASSES_V2),
            legacy: Object.keys(FIELD_CLASSES_LEGACY)
        };
    }
}

// Exportar como default e named
export default FieldFactoryV2;

// Registrar globalmente
if (typeof window !== 'undefined') {
    window.FieldFactoryV2 = FieldFactoryV2;
}
