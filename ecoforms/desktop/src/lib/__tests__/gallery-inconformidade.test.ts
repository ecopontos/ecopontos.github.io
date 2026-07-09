import { describe, it, expect } from 'vitest';
import { buildEntriesFromQueue, applyQueueSave, type GalleryInconformidadeEntry } from '../gallery-inconformidade';

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

describe('applyQueueSave', () => {
    const existingList: GalleryInconformidadeEntry[] = [
        { id_foto: 'e1', imagem: 'img1', criado_em: '2026-01-01T00:00:00.000Z', inconformidades: [], observacao: '' },
        { id_foto: 'e2', imagem: 'img2', criado_em: '2026-01-02T00:00:00.000Z', inconformidades: [], observacao: '' },
    ];
    const newEntries: GalleryInconformidadeEntry[] = [
        { id_foto: 'n1', imagem: 'img3', criado_em: '2026-01-03T00:00:00.000Z', inconformidades: ['INC-001'], observacao: 'nova' },
    ];

    it('quando editingId é null, apenas anexa newEntries ao existingList (adicionar novo)', () => {
        const result = applyQueueSave(existingList, null, newEntries);
        expect(result).toEqual([...existingList, ...newEntries]);
    });

    it('quando editingId corresponde a uma entrada existente, remove-a e anexa newEntries (substituir, não duplicar)', () => {
        const result = applyQueueSave(existingList, existingList[0].id_foto, newEntries);
        expect(result).toEqual([existingList[1], ...newEntries]);
        expect(result.find((e) => e.id_foto === 'e1')).toBeUndefined();
    });
});
