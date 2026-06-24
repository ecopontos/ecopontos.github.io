import { describe, it, expect } from 'vitest';
import {
    isValidProjectTransition,
    isTerminalProjectStatus,
    type ProjectStatus,
} from '../ProjectStatus';

describe('ProjectStatus', () => {
    const allStatuses: ProjectStatus[] = ['ativo', 'pausado', 'concluido', 'cancelado'];

    describe('transições válidas', () => {
        it('ativo → pausado', () => {
            expect(isValidProjectTransition('ativo', 'pausado')).toBe(true);
        });

        it('ativo → concluido', () => {
            expect(isValidProjectTransition('ativo', 'concluido')).toBe(true);
        });

        it('ativo → cancelado', () => {
            expect(isValidProjectTransition('ativo', 'cancelado')).toBe(true);
        });

        it('pausado → ativo', () => {
            expect(isValidProjectTransition('pausado', 'ativo')).toBe(true);
        });

        it('pausado → concluido', () => {
            expect(isValidProjectTransition('pausado', 'concluido')).toBe(true);
        });

        it('pausado → cancelado', () => {
            expect(isValidProjectTransition('pausado', 'cancelado')).toBe(true);
        });
    });

    describe('estados terminais', () => {
        it('concluido é terminal', () => {
            expect(isTerminalProjectStatus('concluido')).toBe(true);
        });

        it('cancelado é terminal', () => {
            expect(isTerminalProjectStatus('cancelado')).toBe(true);
        });

        it('ativo não é terminal', () => {
            expect(isTerminalProjectStatus('ativo')).toBe(false);
        });

        it('pausado não é terminal', () => {
            expect(isTerminalProjectStatus('pausado')).toBe(false);
        });

        it('terminal não permite transição para nenhum estado', () => {
            for (const terminal of ['concluido', 'cancelado'] as ProjectStatus[]) {
                for (const target of allStatuses) {
                    expect(isValidProjectTransition(terminal, target)).toBe(false);
                }
            }
        });
    });

    describe('transições inválidas', () => {
        it('ativo → ativo (self-transition)', () => {
            expect(isValidProjectTransition('ativo', 'ativo')).toBe(false);
        });

        it('concluido → ativo (reabertura proibida)', () => {
            expect(isValidProjectTransition('concluido', 'ativo')).toBe(false);
        });

        it('cancelado → pausado (reabertura proibida)', () => {
            expect(isValidProjectTransition('cancelado', 'pausado')).toBe(false);
        });

        it('pausado → pausado (self-transition)', () => {
            expect(isValidProjectTransition('pausado', 'pausado')).toBe(false);
        });

        it('ativo → estado inexistente retorna false', () => {
            // @ts-expect-error — testando comportamento com valor inválido
            expect(isValidProjectTransition('ativo', 'inexistente')).toBe(false);
        });
    });

    describe('cobertura', () => {
        it('4 estados definidos', () => {
            expect(allStatuses.length).toBe(4);
        });

        it('concluido e cancelado são os únicos terminais', () => {
            const terminals = allStatuses.filter(isTerminalProjectStatus);
            expect(terminals).toEqual(['concluido', 'cancelado']);
        });
    });
});
