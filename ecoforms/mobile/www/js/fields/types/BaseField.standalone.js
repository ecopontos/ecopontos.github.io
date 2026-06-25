/**
 * BaseField - Versão Standalone (Sem ES6 Modules)
 * Classe base para todos os campos do formulário
 * Esta versão é compatível com carregamento via <script> tags
 */

class BaseField {
    constructor(config = {}) {
        // Sanitizar ID
        const rawId = config.id || config.name || '';
        const sanitizedId = this.sanitizeId(rawId);

        this.config = {
            id: sanitizedId,
            name: config.name || sanitizedId,
            label: config.label || '',
            placeholder: config.placeholder || '',
            required: !!config.required,
            description: config.description || '',
            validation: { ...config.validation },
            attributes: { ...config.attributes },
            value: config.value,
            ...config
        };

        // Backwards-compat: se o autor do formulário aninhô propriedades sob `config`
        if (config && config.config && typeof config.config === 'object') {
            try {
                const nested = config.config;
                Object.keys(nested).forEach(k => {
                    if (this.config[k] === undefined) {
                        this.config[k] = nested[k];
                    }
                });
                delete this.config.config;
            } catch (e) {
                // ignorar erros de merge
            }
        }

        // Referências legadas
        this.id = this.config.id;
        this.name = this.config.name;

        this.value = this.config.value !== undefined ? this.config.value : this.getDefaultValue();
        this.errors = [];
        this.isValid = true;
        this.isDirty = false;
        this.isTouched = false;
        this.Alpine = this.config.Alpine;

        this.init();
    }

    /**
     * Sanitiza um ID removendo caracteres inválidos
     */
    sanitizeId(rawId) {
        if (!rawId) return '';
        return String(rawId)
            .trim()
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .replace(/^[0-9]/, '_$&');
    }

    /**
     * Inicialização customizada (override em subclasses)
     */
    init() {
        // Subclasses podem sobrescrever
    }

    /**
     * Retorna o valor padrão do campo
     */
    getDefaultValue() {
        return '';
    }

    /**
     * Renderiza o campo (deve ser implementado pelas subclasses)
     */
    render() {
        throw new Error('render() deve ser implementado pela subclasse');
    }

    /**
     * Renderiza apenas o input do campo
     */
    renderInput() {
        throw new Error('renderInput() deve ser implementado pela subclasse');
    }

    /**
     * Obtém o valor do campo
     */
    getValue() {
        return this.value;
    }

    /**
     * Define o valor do campo
     */
    setValue(value) {
        this.value = value;
        this.isDirty = true;
    }

    /**
     * Valida o campo
     */
    validate() {
        this.errors = [];

        // Validação required
        if (this.config.required) {
            const value = this.getValue();
            if (value === null || value === undefined || value === '') {
                this.errors.push(`${this.config.label || this.config.name} é obrigatório`);
            }
        }

        // Validações customizadas
        if (this.config.validation && typeof this.config.validation === 'object') {
            const value = this.getValue();

            // Min length
            if (this.config.validation.minLength && typeof value === 'string') {
                if (value.length < this.config.validation.minLength) {
                    this.errors.push(`Mínimo de ${this.config.validation.minLength} caracteres`);
                }
            }

            // Max length
            if (this.config.validation.maxLength && typeof value === 'string') {
                if (value.length > this.config.validation.maxLength) {
                    this.errors.push(`Máximo de ${this.config.validation.maxLength} caracteres`);
                }
            }

            // Pattern
            if (this.config.validation.pattern) {
                const pattern = new RegExp(this.config.validation.pattern);
                if (!pattern.test(String(value))) {
                    this.errors.push(this.config.validation.message || 'Formato inválido');
                }
            }

            // Custom validator
            if (typeof this.config.validation.custom === 'function') {
                const customError = this.config.validation.custom(value, this);
                if (customError) {
                    this.errors.push(customError);
                }
            }
        }

        this.isValid = this.errors.length === 0;
        return this.isValid;
    }

    /**
     * Marca o campo como tocado
     */
    markAsTouched() {
        this.isTouched = true;
    }

    /**
     * Reseta o campo ao estado inicial
     */
    reset() {
        this.value = this.getDefaultValue();
        this.errors = [];
        this.isValid = true;
        this.isDirty = false;
        this.isTouched = false;
    }

    /**
     * Serializa o campo para JSON
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            value: this.getValue(),
            isValid: this.isValid,
            errors: this.errors
        };
    }

    /**
     * Anexa event listeners (override em subclasses se necessário)
     */
    attachEventListeners() {
        // Subclasses implementam conforme necessário
    }

    /**
     * Remove event listeners
     */
    removeEventListeners() {
        // Subclasses implementam conforme necessário
    }

    /**
     * Destroi o campo e limpa recursos
     */
    destroy() {
        this.removeEventListeners();
        this.value = null;
        this.errors = [];
    }
}

// Disponibilizar globalmente
if (typeof window !== 'undefined') {
    window.BaseField = BaseField;
}

console.log('✅ BaseField (standalone) carregado');
