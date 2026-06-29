import { describe, it, expect } from 'vitest';
import { getValidTransitions, isValidTransition, isTerminalStatus, type TaskStatus } from '../TaskStatus';

describe('TaskStatus', () => {
    const allStatuses: TaskStatus[] = ['a_fazer', 'em_progresso', 'concluido', 'cancelado'];

    describe('transições válidas', () => {
        it('a_fazer → em_progresso', () => {
            expect(isValidTransition('a_fazer', 'em_progresso')).toBe(true);
        });

        it('a_fazer → cancelado', () => {
            expect(isValidTransition('a_fazer', 'cancelado')).toBe(true);
        });

        it('em_progresso → a_fazer (retornar)', () => {
            expect(isValidTransition('em_progresso', 'a_fazer')).toBe(true);
        });

        it('em_progresso → concluido', () => {
            expect(isValidTransition('em_progresso', 'concluido')).toBe(true);
        });

        it('em_progresso → cancelado', () => {
            expect(isValidTransition('em_progresso', 'cancelado')).toBe(true);
        });
    });

    describe('estados terminais', () => {
        it('concluido é terminal', () => {
            expect(isTerminalStatus('concluido')).toBe(true);
        });

        it('cancelado é terminal', () => {
            expect(isTerminalStatus('cancelado')).toBe(true);
        });

        it('terminal não aceita transições', () => {
            for (const terminal of ['concluido', 'cancelado'] as TaskStatus[]) {
                for (const target of allStatuses) {
                    expect(isValidTransition(terminal, target)).toBe(false);
                }
            }
        });
    });

    describe('transições disponíveis', () => {
        it('lista apenas destinos válidos para uma tarefa a fazer', () => {
            expect(getValidTransitions('a_fazer')).toEqual(['em_progresso', 'cancelado']);
        });

        it('não lista destinos para status terminal', () => {
            expect(getValidTransitions('concluido')).toEqual([]);
        });
    });

    describe('transições inválidas', () => {
        it('a_fazer → concluido (pular em_progresso)', () => {
            expect(isValidTransition('a_fazer', 'concluido')).toBe(false);
        });

        it('a_fazer → a_fazer (self-transition)', () => {
            expect(isValidTransition('a_fazer', 'a_fazer')).toBe(false);
        });

        it('em_progresso → em_progresso (self-transition)', () => {
            expect(isValidTransition('em_progresso', 'em_progresso')).toBe(false);
        });
    });
});
