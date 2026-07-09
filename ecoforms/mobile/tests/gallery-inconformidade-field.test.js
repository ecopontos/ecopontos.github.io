import { describe, it, expect, beforeEach, vi } from 'vitest';
import GalleryInconformidadeField from '../www/js/fields/types/GalleryInconformidadeField.js';

function makeField(overrides = {}) {
    return new GalleryInconformidadeField({
        id: 'bloco_fotos_vistoria',
        label: 'Evidências Fotográficas',
        type: 'composite_gallery_collector',
        dataSource: 'inconformidades_padrao',
        ...overrides,
    });
}

function makeBase64(byteLength) {
    const raw = 'A'.repeat(Math.ceil(byteLength / 3) * 4);
    return `data:image/jpeg;base64,${raw}`;
}

describe('GalleryInconformidadeField', () => {
    beforeEach(() => {
        window.alert = vi.fn();
        window.confirm = vi.fn(() => true);
        window.fieldInstances = {};
        window.smartCache = undefined;
    });

    it('inicia com value como array vazio quando nenhum valor é passado', () => {
        const field = makeField();
        expect(field.getValue()).toEqual([]);
    });

    it('_adicionarFotoAFila adiciona foto dentro do limite de tamanho', () => {
        const field = makeField({ maxFileSizeKb: 5000 });
        const ok = field._adicionarFotoAFila(makeBase64(1000));
        expect(ok).toBe(true);
        expect(field.filaFotos).toHaveLength(1);
        expect(window.alert).not.toHaveBeenCalled();
    });

    it('_adicionarFotoAFila rejeita foto que excede maxFileSizeKb', () => {
        const field = makeField({ maxFileSizeKb: 1 });
        const ok = field._adicionarFotoAFila(makeBase64(5000));
        expect(ok).toBe(false);
        expect(field.filaFotos).toHaveLength(0);
        expect(window.alert).toHaveBeenCalledTimes(1);
    });

    it('salvarEvidencias cria uma entrada por foto na fila, todas com as mesmas inconformidades e observação', () => {
        const field = makeField();
        field._adicionarFotoAFila(makeBase64(100));
        field._adicionarFotoAFila(makeBase64(100));
        field.toggleInconformidade('INC-001');
        field.toggleInconformidade('INC-004');
        field.setObservacao('Duas evidências da mesma falha');

        const ok = field.salvarEvidencias();

        expect(ok).toBe(true);
        expect(field.getValue()).toHaveLength(2);
        field.getValue().forEach((entry) => {
            expect(entry.inconformidades).toEqual(['INC-001', 'INC-004']);
            expect(entry.observacao).toBe('Duas evidências da mesma falha');
            expect(entry.id_foto).toBeTruthy();
            expect(entry.criado_em).toBeTruthy();
        });
        const ids = field.getValue().map((e) => e.id_foto);
        expect(new Set(ids).size).toBe(2);
        expect(field.modalAberta).toBe(false);
        expect(field.filaFotos).toHaveLength(0);
    });

    it('salvarEvidencias não faz nada quando a fila está vazia', () => {
        const field = makeField();
        const ok = field.salvarEvidencias();
        expect(ok).toBe(false);
        expect(field.getValue()).toHaveLength(0);
        expect(window.alert).toHaveBeenCalledTimes(1);
    });

    it('salvarEvidencias respeita maxFiles', () => {
        const field = makeField({ maxFiles: 1 });
        field._adicionarFotoAFila(makeBase64(100));
        field.salvarEvidencias();
        expect(field.getValue()).toHaveLength(1);

        field.abrirModal();
        field._adicionarFotoAFila(makeBase64(100));
        const ok = field.salvarEvidencias();

        expect(ok).toBe(false);
        expect(field.getValue()).toHaveLength(1);
    });

    it('validate() bloqueia envio com 0 fotos quando required', () => {
        const field = makeField({ required: true });
        const valid = field.validate();
        expect(valid).toBe(false);
        expect(field.errors.length).toBeGreaterThan(0);
    });

    it('validate() não bloqueia foto sem inconformidade marcada', () => {
        const field = makeField({ required: true });
        field._adicionarFotoAFila(makeBase64(100));
        field.salvarEvidencias();

        const valid = field.validate();
        expect(valid).toBe(true);
    });

    it('carregarInconformidades filtra itens com ativo === false', async () => {
        window.smartCache = {
            loadDataSource: vi.fn().mockResolvedValue([
                { id: 'INC-001', label: 'Fiação exposta', ativo: true },
                { id: 'INC-002', label: 'Item desativado', ativo: false },
                { id: 'INC-003', label: 'Sem flag ativo' },
            ]),
        };
        const field = makeField();
        await field.carregarInconformidades();

        expect(field.inconformidadesOptions).toEqual([
            { id: 'INC-001', label: 'Fiação exposta' },
            { id: 'INC-003', label: 'Sem flag ativo' },
        ]);
    });
});
