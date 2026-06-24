import InputFieldBase from './InputFieldBase.js';

/**
 * Campo para entrada de senhas.
 * Refatorado para usar InputFieldBase (Phase 3 consolidation)
 */
export default class PasswordField extends InputFieldBase {
    constructor(config) {
        super(config);
    }

    /**
     * Override to specify this is a password input
     */
    getInputType(config) {
        return 'password';
    }
}

// Registra o campo globalmente
if (typeof window !== 'undefined') {
    window.PasswordField = PasswordField;
}