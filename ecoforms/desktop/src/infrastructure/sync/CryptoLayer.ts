const STORE_KEY = 'org_crypto_key';
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_HASH = 'SHA-256';

export class CryptoLayer {
    private cryptoKey: CryptoKey | null = null;
    private _Store: typeof import('@tauri-apps/plugin-store').Store | null = null;

    private get keyLoaded(): boolean {
        return this.cryptoKey !== null;
    }

    private async getStore() {
        if (!this._Store) {
            this._Store = (await import('@tauri-apps/plugin-store')).Store;
        }
        return this._Store;
    }

    private async purgeLegacyStore(): Promise<void> {
        try {
            const Store = await this.getStore();
            const store = await Store.load('.ecoforms-keys.dat');
            const legacyStore = store as unknown as {
                get(key: string): Promise<unknown>;
                delete(key: string): Promise<void>;
                save(): Promise<void>;
            };
            const legacyValue = await legacyStore.get(STORE_KEY);
            if (legacyValue !== null && legacyValue !== undefined) {
                await legacyStore.delete(STORE_KEY);
                await legacyStore.save();
            }
        } catch {
            // Best-effort cleanup for old raw-key files.
        }
    }

    private async importRawKey(keyBytes: Uint8Array): Promise<CryptoKey> {
        const buf = new ArrayBuffer(keyBytes.byteLength);
        new Uint8Array(buf).set(keyBytes);
        return crypto.subtle.importKey('raw', buf, 'AES-GCM', false, ['encrypt', 'decrypt']);
    }

    async loadKey(): Promise<void> {
        if (this.keyLoaded) return;
        await this.purgeLegacyStore();
    }

    async deriveAndStoreKey(password: string, userSalt: string): Promise<Uint8Array> {
        const saltBytes = new TextEncoder().encode(userSalt);
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            'PBKDF2',
            false,
            ['deriveBits'],
        );
        const keyBits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
            keyMaterial,
            256,
        );
        const rawKey = new Uint8Array(keyBits);
        this.cryptoKey = await this.importRawKey(rawKey);
        await this.purgeLegacyStore();
        return rawKey;
    }

    async clearLegacyKeyStore(): Promise<void> {
        await this.purgeLegacyStore();
    }

    clearKey(): void {
        this.cryptoKey = null;
    }

    async encrypt(data: string): Promise<Uint8Array> {
        if (!this.keyLoaded) await this.loadKey();
        if (!this.cryptoKey) throw new Error('Chave não carregada. Faça login para derivar a chave.');
        const nonce = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: nonce },
            this.cryptoKey,
            new TextEncoder().encode(data),
        );
        const blob = new Uint8Array(12 + ciphertext.byteLength);
        blob.set(nonce, 0);
        blob.set(new Uint8Array(ciphertext), 12);
        return blob;
    }

    async decrypt(blob: Uint8Array): Promise<string> {
        if (!this.keyLoaded) await this.loadKey();
        if (!this.cryptoKey) throw new Error('Chave não carregada. Faça login para derivar a chave.');
        if (blob.length < 13) throw new Error('Blob inválido: muito curto.');
        const plaintext = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: blob.slice(0, 12) },
            this.cryptoKey,
            blob.slice(12),
        );
        return new TextDecoder().decode(plaintext);
    }

    async encryptJson(obj: unknown): Promise<Uint8Array> {
        return this.encrypt(JSON.stringify(obj));
    }

    async decryptJson<T>(blob: Uint8Array): Promise<T> {
        const json = await this.decrypt(blob);
        return JSON.parse(json) as T;
    }
}
