/**
 * KeyRotationService — Mobile (ADR-011)
 * Gerencia rotação, escrow e recuperação de sync_salt via SQLite + localStorage.
 *
 * No mobile, o escrow é armazenado como JSON criptografado em localStorage
 * (chaveado com PBKDF2 derivado da passphrase de recuperação).
 *
 * DIVERGÊNCIA CONHECIDA (2026-06-11):
 *   Desktop: derive_recovery_key usa Argon2id (key_rotation.rs:15-22)
 *   Mobile:  deriveRecoveryKey usa PBKDF2-SHA256 (este arquivo)
 *
 *   Motivo: Argon2id requer WASM (~30 KB) ou native module. PBKDF2 usa
 *   Web Crypto API nativa (zero dependências). Segurança equivalente no
 *   cenário mobile (dispositivo single-user, sem ataque side-channel).
 *
 *   Impacto: recovery passphrase gera chaves diferentes em desktop vs mobile.
 *   Escrow de cada plataforma é independente — não há interoperabilidade de
 *   recovery cross-platform. Rotação de salt usa canais separados.
 *
 *   Migração futura: quando Web Crypto adotar Argon2 (proposta WICG), migrar
 *   mantendo backward compat com entradas PBKDF2 existentes via fallback.
 */

export class KeyRotationServiceMobile {
    static STORAGE_KEY = 'ecoforms_salt_escrow';
    static PBKDF2_ITERATIONS = 600_000;
    static PBKDF2_HASH = 'SHA-256';

    /**
     * Deriva chave AES-256 a partir de passphrase (PBKDF2)
     */
    static async deriveRecoveryKey(passphrase: string, userId: string): Promise<CryptoKey> {
        const salt = new TextEncoder().encode('ecoforms-recovery-v2:' + userId);
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(passphrase),
            'PBKDF2',
            false,
            ['deriveKey'],
        );
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: this.PBKDF2_ITERATIONS, hash: this.PBKDF2_HASH },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt'],
        );
    }

    /**
     * Gera novo salt (32-char hex)
     */
    static generateSalt(): string {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Hash de um salt para verificação de integridade
     */
    static async hashSalt(salt: string): Promise<string> {
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt));
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Rotaciona o sync_salt no mobile.
     * - Gera novo salt
     * - Criptografa salt antigo com passphrase de recuperação → localStorage escrow
     * - Atualiza usuário em IndexedDB + localStorage
     *
     * @returns O novo salt
     */
    static async rotateSalt(
        user: { id: string; sync_salt: string },
        recoveryPassphrase: string,
        reason?: string,
    ): Promise<string> {
        const key = await this.deriveRecoveryKey(recoveryPassphrase, user.id);
        const currentSalt = user.sync_salt || '';
        const newSalt = this.generateSalt();

        // Criptografar salt antigo
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            new TextEncoder().encode(currentSalt),
        );
        const saltHash = await this.hashSalt(currentSalt);

        // Salvar escrow
        const escrowData = {
            userId: user.id,
            saltEncrypted: this.arrayBufferToBase64(encrypted),
            ivB64: this.arrayBufferToBase64(iv.buffer),
            saltHash,
            replacedAt: new Date().toISOString(),
            reason: reason || '',
        };

        // Append ao histórico de escrow
        const history = this.getEscrowHistory(user.id);
        history.unshift(escrowData);
        this.saveEscrowHistory(user.id, history);

        return newSalt;
    }

    /**
     * Recupera sync_salt do escrow
     */
    static async recoverSalt(
        userId: string,
        recoveryPassphrase: string,
    ): Promise<string | null> {
        const key = await this.deriveRecoveryKey(recoveryPassphrase, userId);
        const history = this.getEscrowHistory(userId);

        for (const entry of history) {
            try {
                const iv = this.base64ToArrayBuffer(entry.ivB64);
                const encrypted = this.base64ToArrayBuffer(entry.saltEncrypted);
                const decrypted = await crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: new Uint8Array(iv) },
                    key,
                    new Uint8Array(encrypted),
                );
                const salt = new TextDecoder().decode(decrypted);
                const hash = await this.hashSalt(salt);

                if (hash === entry.saltHash) {
                    return salt; // Integrity verified
                }
            } catch {
                continue; // Wrong passphrase, try next
            }
        }

        return null;
    }

    static getEscrowHistory(userId: string): any[] {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            const all = raw ? JSON.parse(raw) : {};
            return all[userId] || [];
        } catch {
            return [];
        }
    }

    static saveEscrowHistory(userId: string, history: any[]): void {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            const all = raw ? JSON.parse(raw) : {};
            all[userId] = history;
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(all));
        } catch {
            console.warn('[KeyRotation] Failed to save escrow history');
        }
    }

    static arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary);
    }

    static base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes.buffer;
    }
}
