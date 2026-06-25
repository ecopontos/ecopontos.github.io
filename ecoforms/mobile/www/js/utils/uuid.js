function uuidv7() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);

        const ts = BigInt(Date.now());
        bytes[0] = Number((ts >> 40n) & 0xFFn);
        bytes[1] = Number((ts >> 32n) & 0xFFn);
        bytes[2] = Number((ts >> 24n) & 0xFFn);
        bytes[3] = Number((ts >> 16n) & 0xFFn);
        bytes[4] = Number((ts >> 8n) & 0xFFn);
        bytes[5] = Number(ts & 0xFFn);

        bytes[6] = (bytes[6] & 0x0f) | 0x70;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;

        const hex = Array.from(bytes, function (b) { return b.toString(16).padStart(2, '0'); });
        return hex[0] + hex[1] + hex[2] + hex[3] + '-' +
               hex[4] + hex[5] + '-' +
               hex[6] + hex[7] + '-' +
               hex[8] + hex[9] + '-' +
               hex[10] + hex[11] + hex[12] + hex[13] + hex[14] + hex[15];
    }
    throw new Error('crypto.getRandomValues não está disponível. Não é possível gerar UUID seguro.');
}

class UuidGenerator {
    generateUUID() {
        return uuidv7();
    }
}

const uuidGenerator = new UuidGenerator();
if (typeof window !== 'undefined') {
    window.uuidv7 = uuidv7;
    window.UuidGenerator = UuidGenerator;
    window.uuidGenerator = uuidGenerator;
}
if (typeof globalThis !== 'undefined') {
    globalThis.uuidv7 = uuidv7;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { uuidv7, UuidGenerator, uuidGenerator };
}
