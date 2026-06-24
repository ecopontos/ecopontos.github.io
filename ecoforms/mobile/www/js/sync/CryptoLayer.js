// ⚠️ ESPELHO de desktop/src/infrastructure/sync/CryptoLayer.ts
// Alterações aqui devem ser refletidas lá.
const PBKDF2_ITERATIONS = 600000;
const PBKDF2_HASH = 'SHA-256';

export class CryptoLayer {
  constructor() {
    this.cryptoKey = null;
  }

  async deriveKey(password, userSalt) {
    if (!userSalt) throw new Error('userSalt é obrigatório para derivar chave de sincronização');
    const salt = new TextEncoder().encode(userSalt);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const keyBits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: PBKDF2_HASH },
      keyMaterial,
      256
    );
    this.cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBits,
      'AES-GCM',
      false,
      ['encrypt', 'decrypt']
    );
    return this.cryptoKey;
  }

  clearKey() {
    this.cryptoKey = null;
  }

  isReady() {
    return this.cryptoKey !== null;
  }

  async encryptJson(obj) {
    if (!this.cryptoKey) throw new Error('Chave não carregada. Chame deriveKey(password) primeiro.');
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(obj));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      this.cryptoKey,
      encoded
    );
    const blob = new Uint8Array(nonce.length + ciphertext.byteLength);
    blob.set(nonce, 0);
    blob.set(new Uint8Array(ciphertext), nonce.length);
    return blob;
  }

  async decryptJson(blob) {
    if (!this.cryptoKey) throw new Error('Chave não carregada. Chame deriveKey(password) primeiro.');
    const nonce = blob.slice(0, 12);
    const data = blob.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: nonce },
      this.cryptoKey,
      data
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  }
}
