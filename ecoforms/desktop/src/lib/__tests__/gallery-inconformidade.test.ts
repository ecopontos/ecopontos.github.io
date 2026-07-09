import { describe, it, expect } from 'vitest';
import { buildEntriesFromQueue } from '../gallery-inconformidade';

describe('buildEntriesFromQueue', () => {
    it('cria uma entrada por foto na fila, todas com as mesmas inconformidades e observação', () => {
        const queue = [
            { localId: 'a', imagemBase64: 'data:image/jpeg;base64,AAA' },
            { localId: 'b', imagemBase64: 'data:image/jpeg;base64,BBB' },
        ];
        const entries = buildEntriesFromQueue(queue, ['INC-001', 'INC-004'], 'Duas evidências');

        expect(entries).toHaveLength(2);
        entries.forEach((entry, i) => {
            expect(entry.imagem).toBe(queue[i].imagemBase64);
            expect(entry.inconformidades).toEqual(['INC-001', 'INC-004']);
            expect(entry.observacao).toBe('Duas evidências');
            expect(entry.id_foto).toBeTruthy();
            expect(entry.criado_em).toBeTruthy();
        });
        const ids = entries.map((e) => e.id_foto);
        expect(new Set(ids).size).toBe(2);
    });

    it('retorna array vazio quando a fila está vazia', () => {
        expect(buildEntriesFromQueue([], [], '')).toEqual([]);
    });
});
