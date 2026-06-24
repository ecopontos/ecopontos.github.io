import { describe, it, expect } from 'vitest';

// Carregar o script global antes dos testes
const fs = require('fs');
const path = require('path');
const safeJsonPath = path.resolve(__dirname, '../www/js/utils/safe-json.js');
if (fs.existsSync(safeJsonPath)) {
    eval(fs.readFileSync(safeJsonPath, 'utf-8'));
}

const { safeStringify, safeParse, computeContentHash } = globalThis;

describe('safeStringify', () => {
    it('serializa objetos simples corretamente', () => {
        const obj = { a: 1, b: 'texto' };
        expect(safeStringify(obj)).toBe('{"a":1,"b":"texto"}');
    });

    it('ordena chaves alfabeticamente (determinístico)', () => {
        const obj = { z: 1, a: 2, m: 3 };
        expect(safeStringify(obj)).toBe('{"a":2,"m":3,"z":1}');
    });

    it('converte BigInt para string marcada', () => {
        const obj = { valor: BigInt('9007199254740993') };
        expect(safeStringify(obj)).toBe('{"valor":"__BigInt__:9007199254740993"}');
    });

    it('converte Date para ISO string', () => {
        const date = new Date('2024-06-15T10:30:00.000Z');
        const obj = { criado: date };
        expect(safeStringify(obj)).toBe('{"criado":"2024-06-15T10:30:00.000Z"}');
    });

    it('lida com referências circulares', () => {
        const obj = { a: 1 };
        obj.self = obj;
        expect(safeStringify(obj)).toBe('{"a":1,"self":"[Circular]"}');
    });

    it('omite functions', () => {
        const obj = { a: 1, fn: () => 42 };
        expect(safeStringify(obj)).toBe('{"a":1}');
    });

    it('omite symbols', () => {
        const obj = { a: 1, sym: Symbol('x') };
        expect(safeStringify(obj)).toBe('{"a":1}');
    });

    it('converte undefined em arrays para null', () => {
        const arr = [1, undefined, 3];
        expect(safeStringify(arr)).toBe('[1,null,3]');
    });

    it('omite undefined em objetos', () => {
        const obj = { a: 1, b: undefined };
        expect(safeStringify(obj)).toBe('{"a":1}');
    });

    it('produz saída idêntica para objetos equivalentes com ordem de chaves diferente', () => {
        const obj1 = { z: 1, a: { nested: true, value: 2 } };
        const obj2 = { a: { value: 2, nested: true }, z: 1 };
        expect(safeStringify(obj1)).toBe(safeStringify(obj2));
    });

    it('lida com nested objects e arrays complexos', () => {
        const obj = {
            users: [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' }
            ],
            meta: { total: 2 }
        };
        const result = safeStringify(obj);
        expect(result).toContain('"id":1');
        expect(result).toContain('"name":"Alice"');
        expect(result).toContain('"total":2');
    });
});

describe('safeParse', () => {
    it('converte strings de BigInt de volta', () => {
        const json = '{"valor":"__BigInt__:123"}';
        const parsed = safeParse(json);
        expect(parsed.valor).toBe(BigInt(123));
    });

    it('parse normal funciona para dados sem BigInt', () => {
        const obj = { a: 1, b: 'texto' };
        const parsed = safeParse(safeStringify(obj));
        expect(parsed).toEqual(obj);
    });
});

describe('computeContentHash', () => {
    it('retorna o mesmo hash para objetos idênticos', async () => {
        const obj = { a: 1, b: 'teste' };
        const hash1 = await computeContentHash(obj);
        const hash2 = await computeContentHash(obj);
        expect(hash1).toBe(hash2);
    });

    it('retorna o mesmo hash independente da ordem das chaves', async () => {
        const obj1 = { z: 1, a: 2 };
        const obj2 = { a: 2, z: 1 };
        const hash1 = await computeContentHash(obj1);
        const hash2 = await computeContentHash(obj2);
        expect(hash1).toBe(hash2);
    });

    it('retorna hashes diferentes para objetos diferentes', async () => {
        const obj1 = { a: 1 };
        const obj2 = { a: 2 };
        const hash1 = await computeContentHash(obj1);
        const hash2 = await computeContentHash(obj2);
        expect(hash1).not.toBe(hash2);
    });

    it('funciona com payloads grandes', async () => {
        const large = {};
        for (let i = 0; i < 1000; i++) {
            large[`key_${i}`] = `value_${i}`;
        }
        const hash = await computeContentHash(large);
        expect(hash).toHaveLength(64);
        expect(hash).toMatch(/^[a-f0-9]+$/);
    });

    it('lida com BigInt sem crash', async () => {
        const obj = { id: BigInt(9999999999999999) };
        const hash = await computeContentHash(obj);
        expect(hash).toHaveLength(64);
    });
});
