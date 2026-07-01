import { describe, it, expect } from 'vitest';
import { podeCancelarAgendamento } from '../Agendamento';

describe('podeCancelarAgendamento', () => {
    it('permite cancelar quando pendente', () => {
        expect(podeCancelarAgendamento('pendente')).toBe(true);
    });

    it('permite cancelar quando confirmado', () => {
        expect(podeCancelarAgendamento('confirmado')).toBe(true);
    });

    it('nao permite cancelar quando realizado', () => {
        expect(podeCancelarAgendamento('realizado')).toBe(false);
    });

    it('nao permite cancelar quando ja cancelado', () => {
        expect(podeCancelarAgendamento('cancelado')).toBe(false);
    });
});
