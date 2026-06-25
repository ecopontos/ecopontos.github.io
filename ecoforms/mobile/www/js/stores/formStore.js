/**
 * Store centralizado para dados do formulário
 * Substitui window.formData e window.errors
 * @typedef {import('../types/form').FormData} FormData
 * @typedef {import('../types/form').FormErrors} FormErrors
 * @typedef {import('../types/form').FormContent} FormContent
 */

/**
 * Cria o store de formulário
 * @returns {Object}
 */
export function createFormStore() {
    return {
        // Estado
        /** @type {FormData} */
        data: {},

        /** @type {FormContent | null} */
        config: null,

        /** @type {FormErrors} */
        errors: {},

        // Getters
        /**
         * Obtém o valor de um campo
         * @param {string} fieldId
         * @returns {any}
         */
        getFieldValue(fieldId) {
            return this.data[fieldId];
        },

        /**
         * Obtém o erro de um campo
         * @param {string} fieldId
         * @returns {string | undefined}
         */
        getFieldError(fieldId) {
            return this.errors[fieldId];
        },

        /**
         * Verifica se um campo tem erro
         * @param {string} fieldId
         * @returns {boolean}
         */
        hasFieldError(fieldId) {
            return !!this.errors[fieldId];
        },

        // Setters
        /**
         * Define o valor de um campo
         * @param {string} fieldId
         * @param {any} value
         */
        setFieldValue(fieldId, value) {
            this.data[fieldId] = value;
            // Limpar erro quando campo é alterado
            delete this.errors[fieldId];
        },

        /**
         * Define um erro para um campo
         * @param {string} fieldId
         * @param {string} error
         */
        setFieldError(fieldId, error) {
            this.errors[fieldId] = error;
        },

        /**
         * Limpa o erro de um campo
         * @param {string} fieldId
         */
        clearFieldError(fieldId) {
            delete this.errors[fieldId];
        },

        /**
         * Limpa todos os erros
         */
        clearAllErrors() {
            this.errors = {};
        },

        // Validação
        /**
         * Valida o formulário
         * @returns {boolean} true se válido
         */
        validate() {
            if (!this.config || !this.config.campos) return true;

            this.errors = {};
            let isValid = true;

            for (const field of this.config.campos) {
                if (field.required) {
                    const value = this.data[field.id];
                    if (value === undefined || value === null || value === '') {
                        this.errors[field.id] = `${field.label} é obrigatório`;
                        isValid = false;
                    }
                }
            }

            return isValid;
        },

        /**
         * Obtém todos os campos com erro
         * @returns {string[]} Array de IDs de campos com erro
         */
        getFieldsWithErrors() {
            return Object.keys(this.errors);
        },

        /**
         * Verifica se o formulário tem erros
         * @returns {boolean}
         */
        hasErrors() {
            return Object.keys(this.errors).length > 0;
        },

        // Reset
        /**
         * Reseta o formulário
         */
        reset() {
            this.data = {};
            this.errors = {};
        },

        /**
         * Reseta apenas os dados (mantém erros)
         */
        resetData() {
            this.data = {};
        },

        /**
         * Define a configuração do formulário
         * @param {FormContent} config
         */
        setConfig(config) {
            this.config = config;
        }
    };
}

// Registrar store no Alpine quando disponível
if (typeof window !== 'undefined') {
    // Aguardar Alpine estar disponível
    document.addEventListener('alpine:init', () => {
        if (window.Alpine && typeof window.Alpine.store === 'function') {
            window.Alpine.store('form', createFormStore());
            console.log('✅ Form store registered');
        }
    });
}
