/**
 * FormValidator - Módulo puro de validação de formulários
 * Sem dependências de Alpine.js ou DOM
 * 
 * Suporta validação de:
 * - Campos obrigatórios
 * - Tipos de dados (text, number, email, tel, date, etc.)
 * - Regras customizadas
 * - Validação condicional
 * - Validação assíncrona
 * 
 * @example
 * const validator = new FormValidator();
 * 
 * const result = await validator.validate({
 *   email: 'user@example.com',
 *   age: 25
 * }, {
 *   email: { required: true, type: 'email' },
 *   age: { required: true, type: 'number', min: 18 }
 * });
 * 
 * if (!result.valid) {
 *   console.log('Errors:', result.errors);
 * }
 */

import { eventBus } from './EventEmitter.js';

export class FormValidator {
    constructor(options = {}) {
        this.options = {
            stopOnFirstError: false,
            emitEvents: true,
            locale: 'pt-BR',
            ...options
        };

        this.customRules = new Map();
        this.fieldTypes = this.initializeFieldTypes();
        this.messages = this.initializeMessages();
    }

    /**
     * Define tipos de campos suportados e suas regras de validação
     */
    initializeFieldTypes() {
        return {
            text: {
                validate: (value) => typeof value === 'string',
                sanitize: (value) => String(value).trim()
            },
            number: {
                validate: (value) => !isNaN(parseFloat(value)) && isFinite(value),
                sanitize: (value) => parseFloat(value)
            },
            integer: {
                validate: (value) => Number.isInteger(Number(value)),
                sanitize: (value) => parseInt(value, 10)
            },
            email: {
                validate: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
                sanitize: (value) => String(value).trim().toLowerCase()
            },
            tel: {
                validate: (value) => /^[\d\s\-\+\(\)]+$/.test(value),
                sanitize: (value) => String(value).replace(/\D/g, '')
            },
            url: {
                validate: (value) => {
                    try {
                        new URL(value);
                        return true;
                    } catch {
                        return false;
                    }
                },
                sanitize: (value) => String(value).trim()
            },
            date: {
                validate: (value) => !isNaN(Date.parse(value)),
                sanitize: (value) => new Date(value).toISOString()
            },
            datetime: {
                validate: (value) => !isNaN(Date.parse(value)),
                sanitize: (value) => new Date(value).toISOString()
            },
            select: {
                validate: (value) => {
                    if (value === null || value === undefined || value === '') return true; // required check handled separately
                    if (Array.isArray(value)) {
                        return value.every(item => item !== null && item !== undefined && String(item).trim() !== '');
                    }
                    return ['string', 'number', 'boolean'].includes(typeof value);
                },
                sanitize: (value) => {
                    if (value === null || value === undefined) return '';
                    if (Array.isArray(value)) {
                        return value
                            .map(item => item === null || item === undefined ? '' : String(item).trim())
                            .filter(item => item !== '');
                    }
                    return String(value).trim();
                }
            },
            chips: {
                validate: (value) => Array.isArray(value),
                sanitize: (value) => {
                    if (Array.isArray(value)) return value.map(item => (item === null || item === undefined ? '' : String(item).trim())).filter(item => item !== '');
                    if (value === null || value === undefined) return [];
                    return [String(value).trim()];
                }
            },
            time: {
                validate: (value) => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value),
                sanitize: (value) => value
            },
            boolean: {
                validate: (value) => typeof value === 'boolean' || ['true', 'false', '1', '0'].includes(String(value).toLowerCase()),
                sanitize: (value) => {
                    if (typeof value === 'boolean') return value;
                    return ['true', '1', 'yes', 'sim'].includes(String(value).toLowerCase());
                }
            },
            array: {
                validate: (value) => Array.isArray(value),
                sanitize: (value) => Array.isArray(value) ? value : [value]
            },
            object: {
                validate: (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
                sanitize: (value) => value
            },
            file: {
                validate: (value) => value instanceof File || (typeof value === 'object' && value.name && value.size),
                sanitize: (value) => value
            },
            image: {
                validate: (value) => {
                    if (value instanceof File) {
                        return value.type.startsWith('image/');
                    }
                    if (typeof value === 'string') {
                        return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(value);
                    }
                    return false;
                },
                sanitize: (value) => value
            },
            cpf: {
                validate: (value) => this.validateCPF(value),
                sanitize: (value) => String(value).replace(/\D/g, '')
            },
            cnpj: {
                validate: (value) => this.validateCNPJ(value),
                sanitize: (value) => String(value).replace(/\D/g, '')
            },
            cep: {
                validate: (value) => /^\d{5}-?\d{3}$/.test(value),
                sanitize: (value) => String(value).replace(/\D/g, '')
            }
        };
    }

    /**
     * Mensagens de erro padrão
     */
    initializeMessages() {
        return {
            required: 'Este campo é obrigatório',
            type: 'Tipo de dado inválido',
            min: 'Valor mínimo: {min}',
            max: 'Valor máximo: {max}',
            minLength: 'Mínimo de {minLength} caracteres',
            maxLength: 'Máximo de {maxLength} caracteres',
            pattern: 'Formato inválido',
            email: 'Email inválido',
            url: 'URL inválida',
            custom: 'Validação falhou',
            async: 'Validação assíncrona falhou'
        };
    }

    /**
     * Valida dados contra um schema
     * @param {object} data - Dados a validar
     * @param {object} schema - Schema de validação
     * @param {object} context - Contexto adicional para validação condicional
     * @returns {Promise<ValidationResult>} - Resultado da validação
     */
    async validate(data, schema, context = {}) {
        const errors = {};
        const warnings = {};
        const sanitized = {};
        let hasErrors = false;

        // Validar cada campo do schema
        for (const [fieldName, rules] of Object.entries(schema)) {
            const value = data[fieldName];

            // Validação condicional - pular se condição não for atendida
            if (rules.when) {
                const shouldValidate = this.evaluateCondition(rules.when, data, context);
                if (!shouldValidate) {
                    continue;
                }
            }

            const fieldResult = await this.validateField(fieldName, value, rules, data, context);

            if (fieldResult.errors.length > 0) {
                errors[fieldName] = fieldResult.errors;
                hasErrors = true;

                if (this.options.stopOnFirstError) {
                    break;
                }
            }

            if (fieldResult.warnings.length > 0) {
                warnings[fieldName] = fieldResult.warnings;
            }

            sanitized[fieldName] = fieldResult.sanitized;
        }

        const result = {
            valid: !hasErrors,
            errors,
            warnings,
            data: sanitized
        };

        // Emitir evento de validação
        if (this.options.emitEvents) {
            if (hasErrors) {
                eventBus.emit('validationFailed', { errors, data, schema });
            } else {
                eventBus.emit('validationPassed', { data: sanitized, schema });
            }
        }

        return result;
    }

    /**
     * Valida um campo individual
     * @param {string} fieldName - Nome do campo
     * @param {*} value - Valor a validar
     * @param {object} rules - Regras de validação
     * @param {object} data - Dados completos (para validação cross-field)
     * @param {object} context - Contexto adicional
     * @returns {Promise<FieldValidationResult>} - Resultado da validação do campo
     */
    async validateField(fieldName, value, rules, data = {}, context = {}) {
        const errors = [];
        const warnings = [];
        let sanitized = value;

        // 1. Validar obrigatoriedade
        if (rules.required && this.isEmpty(value)) {
            errors.push(this.getMessage('required', rules));
            return { errors, warnings, sanitized: null };
        }

        // Se valor vazio e não obrigatório, pular validações
        if (this.isEmpty(value) && !rules.required) {
            return { errors, warnings, sanitized: null };
        }

        // 2. Sanitizar baseado no tipo
        if (rules.type && this.fieldTypes[rules.type]) {
            const typeHandler = this.fieldTypes[rules.type];
            sanitized = typeHandler.sanitize(value);

            // Validar tipo
            if (!typeHandler.validate(sanitized)) {
                errors.push(this.getMessage('type', { ...rules, type: rules.type }));
                return { errors, warnings, sanitized };
            }
        }

        // 3. Validar limites numéricos
        if (rules.min !== undefined && Number(sanitized) < rules.min) {
            errors.push(this.getMessage('min', rules));
        }

        if (rules.max !== undefined && Number(sanitized) > rules.max) {
            errors.push(this.getMessage('max', rules));
        }

        // 4. Validar comprimento de string
        if (rules.minLength !== undefined && String(sanitized).length < rules.minLength) {
            errors.push(this.getMessage('minLength', rules));
        }

        if (rules.maxLength !== undefined && String(sanitized).length > rules.maxLength) {
            errors.push(this.getMessage('maxLength', rules));
        }

        // 5. Validar padrão regex
        if (rules.pattern) {
            const regex = rules.pattern instanceof RegExp ? rules.pattern : new RegExp(rules.pattern);
            if (!regex.test(String(sanitized))) {
                errors.push(this.getMessage('pattern', rules));
            }
        }

        // 6. Validar valores permitidos (enum)
        if (rules.enum && !rules.enum.includes(sanitized)) {
            errors.push(`Valor deve ser um de: ${rules.enum.join(', ')}`);
        }

        // 7. Validar igualdade com outro campo
        if (rules.equals && data[rules.equals] !== sanitized) {
            errors.push(`Deve ser igual ao campo ${rules.equals}`);
        }

        // 8. Validações customizadas síncronas
        if (rules.custom) {
            const customResult = rules.custom(sanitized, data, context);
            if (customResult !== true) {
                errors.push(customResult || this.getMessage('custom', rules));
            }
        }

        // 9. Validações customizadas assíncronas
        if (rules.asyncValidate) {
            try {
                const asyncResult = await rules.asyncValidate(sanitized, data, context);
                if (asyncResult !== true) {
                    errors.push(asyncResult || this.getMessage('async', rules));
                }
            } catch (error) {
                errors.push(`Erro na validação: ${error.message}`);
            }
        }

        // 10. Validações registradas globalmente
        if (rules.validator && this.customRules.has(rules.validator)) {
            const validator = this.customRules.get(rules.validator);
            const validatorResult = await validator(sanitized, data, context);
            if (validatorResult !== true) {
                errors.push(validatorResult || this.getMessage('custom', rules));
            }
        }

        // 11. Warnings (não impedem validação)
        if (rules.warn) {
            const warnResult = rules.warn(sanitized, data, context);
            if (warnResult !== true) {
                warnings.push(warnResult || 'Aviso de validação');
            }
        }

        return { errors, warnings, sanitized };
    }

    /**
     * Registra uma regra de validação customizada
     * @param {string} name - Nome da regra
     * @param {Function} validator - Função validadora
     */
    registerRule(name, validator) {
        if (typeof validator !== 'function') {
            throw new TypeError('Validator must be a function');
        }
        this.customRules.set(name, validator);
    }

    /**
     * Registra um tipo de campo customizado
     * @param {string} name - Nome do tipo
     * @param {object} handler - Objeto com validate e sanitize
     */
    registerFieldType(name, handler) {
        if (!handler.validate || !handler.sanitize) {
            throw new Error('Field type handler must have validate and sanitize methods');
        }
        this.fieldTypes[name] = handler;
    }

    /**
     * Verifica se valor está vazio
     */
    isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim() === '';
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    }

    /**
     * Avalia condição para validação condicional
     */
    evaluateCondition(condition, data, context) {
        if (typeof condition === 'function') {
            return condition(data, context);
        }

        if (typeof condition === 'object') {
            // Suporta condições como: { field: 'type', equals: 'person' }
            const { field, equals, notEquals, in: inArray } = condition;

            if (equals !== undefined) {
                return data[field] === equals;
            }

            if (notEquals !== undefined) {
                return data[field] !== notEquals;
            }

            if (inArray !== undefined) {
                return inArray.includes(data[field]);
            }
        }

        return true;
    }

    /**
     * Retorna mensagem de erro formatada
     */
    getMessage(type, rules) {
        const template = rules.message || this.messages[type] || this.messages.custom;
        
        // Substituir placeholders
        return template.replace(/{(\w+)}/g, (match, key) => {
            return rules[key] !== undefined ? rules[key] : match;
        });
    }

    /**
     * Valida CPF (algoritmo brasileiro)
     */
    validateCPF(cpf) {
        cpf = String(cpf).replace(/\D/g, '');

        if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) {
            return false;
        }

        let sum = 0;
        for (let i = 0; i < 9; i++) {
            sum += parseInt(cpf.charAt(i)) * (10 - i);
        }
        let digit = 11 - (sum % 11);
        if (digit >= 10) digit = 0;
        if (digit !== parseInt(cpf.charAt(9))) return false;

        sum = 0;
        for (let i = 0; i < 10; i++) {
            sum += parseInt(cpf.charAt(i)) * (11 - i);
        }
        digit = 11 - (sum % 11);
        if (digit >= 10) digit = 0;
        if (digit !== parseInt(cpf.charAt(10))) return false;

        return true;
    }

    /**
     * Valida CNPJ (algoritmo brasileiro)
     */
    validateCNPJ(cnpj) {
        cnpj = String(cnpj).replace(/\D/g, '');

        if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) {
            return false;
        }

        let length = cnpj.length - 2;
        let numbers = cnpj.substring(0, length);
        const digits = cnpj.substring(length);
        let sum = 0;
        let pos = length - 7;

        for (let i = length; i >= 1; i--) {
            sum += parseInt(numbers.charAt(length - i)) * pos--;
            if (pos < 2) pos = 9;
        }

        let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        if (result !== parseInt(digits.charAt(0))) return false;

        length += 1;
        numbers = cnpj.substring(0, length);
        sum = 0;
        pos = length - 7;

        for (let i = length; i >= 1; i--) {
            sum += parseInt(numbers.charAt(length - i)) * pos--;
            if (pos < 2) pos = 9;
        }

        result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
        if (result !== parseInt(digits.charAt(1))) return false;

        return true;
    }

    /**
     * Valida múltiplos conjuntos de dados em lote
     * @param {Array} dataArray - Array de objetos a validar
     * @param {object} schema - Schema de validação
     * @returns {Promise<BatchValidationResult>} - Resultado em lote
     */
    async validateBatch(dataArray, schema) {
        const results = await Promise.all(
            dataArray.map((data, index) => 
                this.validate(data, schema).then(result => ({ ...result, index }))
            )
        );

        const valid = results.every(r => r.valid);
        const errors = results.filter(r => !r.valid);

        return {
            valid,
            results,
            errors,
            successCount: results.filter(r => r.valid).length,
            errorCount: errors.length
        };
    }
}

export default FormValidator;
