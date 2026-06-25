/**
 * HKDF-SHA256 (RFC 5869) — implementação pura em Web Crypto API.
 * Usado no mobile para derivação de domain keys a partir da master key.
 *
 * Compatível com desktop/src-tauri/src/crypto/hkdf.rs.
 */

/**
 * Deriva uma domain key via HKDF-SHA256.
 * @param {Uint8Array} ikm - Input Key Material (master key, 32 bytes)
 * @param {Uint8Array} salt - Salt (opcional, usar new Uint8Array(0) para vazio)
 * @param {Uint8Array} info - Context string (ex: "ecoforms-sync-v1")
 * @param {number} length - Output length in bytes (default 32)
 * @returns {Promise<Uint8Array>} Derived key material
 */
export async function hkdfSha256(ikm, salt, info, length = 32) {
    // Extract: PRK = HMAC-SHA256(salt, IKM)
    const prk = await hmacSha256(salt, ikm);

    // Expand: T(1) = HMAC-SHA256(PRK, info || 0x01)
    const infoConcat = new Uint8Array(info.length + 1);
    infoConcat.set(info, 0);
    infoConcat[info.length] = 1;
    const okm = await hmacSha256(new Uint8Array(prk), infoConcat);

    return new Uint8Array(okm).slice(0, length);
}

/**
 * Deriva uma domain key de 32 bytes (convenience wrapper).
 * @param {Uint8Array} masterKey - 32-byte master key
 * @param {string} context - Domain context (ex: "ecoforms-sync-v1")
 * @returns {Promise<Uint8Array>} 32-byte AES-256 domain key
 */
export async function deriveDomainKey(masterKey, context) {
    const salt = masterKey.slice(0, 8);
    const ctx = new TextEncoder().encode(context);
    return hkdfSha256(masterKey, salt, ctx, 32);
}

async function hmacSha256(key, message) {
    const cryptoKey = await crypto.subtle.importKey(
        'raw', key,
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign']
    );
    return await crypto.subtle.sign('HMAC', cryptoKey, message);
}
