import { describe, it, expect } from 'vitest';
import {
    isValidSuiteTransition,
    isTerminalSuiteStatus,
    type SuiteStatus,
} from '../SuiteStatus';

describe('SuiteStatus', () => {
    const allStatuses: SuiteStatus[] = [
        'draft', 'current', 'approved', 'rejected', 'edit',
        'locked', 'dispatched', 'pending_review', 'refuted',
        'superseded', 'closed',
    ];

    describe('isValidSuiteTransition', () => {
        it('draft → current', () => {
            expect(isValidSuiteTransition('draft', 'current')).toBe(true);
        });

        it('draft → dispatched', () => {
            expect(isValidSuiteTransition('draft', 'dispatched')).toBe(true);
        });

        it('draft → closed', () => {
            expect(isValidSuiteTransition('draft', 'closed')).toBe(true);
        });

        it('draft → edit (inválido)', () => {
            expect(isValidSuiteTransition('draft', 'edit')).toBe(false);
        });

        it('current → pending_review', () => {
            expect(isValidSuiteTransition('current', 'pending_review')).toBe(true);
        });

        it('current → edit', () => {
            expect(isValidSuiteTransition('current', 'edit')).toBe(true);
        });

        it('current → locked', () => {
            expect(isValidSuiteTransition('current', 'locked')).toBe(true);
        });

        it('current → superseded', () => {
            expect(isValidSuiteTransition('current', 'superseded')).toBe(true);
        });

        it('current → closed', () => {
            expect(isValidSuiteTransition('current', 'closed')).toBe(true);
        });

        it('current → draft (inválido — sem volta)', () => {
            expect(isValidSuiteTransition('current', 'draft')).toBe(false);
        });

        it('locked → current (unlock)', () => {
            expect(isValidSuiteTransition('locked', 'current')).toBe(true);
        });

        it('locked → edit (inválido — só pode unlock)', () => {
            expect(isValidSuiteTransition('locked', 'edit')).toBe(false);
        });

        it('pending_review → current (aprovar)', () => {
            expect(isValidSuiteTransition('pending_review', 'current')).toBe(true);
        });

        it('pending_review → refuted (rejeitar)', () => {
            expect(isValidSuiteTransition('pending_review', 'refuted')).toBe(true);
        });

        it('pending_review → closed', () => {
            expect(isValidSuiteTransition('pending_review', 'closed')).toBe(true);
        });

        it('refuted → edit', () => {
            expect(isValidSuiteTransition('refuted', 'edit')).toBe(true);
        });

        it('refuted → closed', () => {
            expect(isValidSuiteTransition('refuted', 'closed')).toBe(true);
        });

        it('refuted → current (inválido)', () => {
            expect(isValidSuiteTransition('refuted', 'current')).toBe(false);
        });

        it('approved → superseded (legacy)', () => {
            expect(isValidSuiteTransition('approved', 'superseded')).toBe(true);
        });

        it('approved → closed (legacy)', () => {
            expect(isValidSuiteTransition('approved', 'closed')).toBe(true);
        });

        it('rejected → edit (legacy)', () => {
            expect(isValidSuiteTransition('rejected', 'edit')).toBe(true);
        });

        it('rejected → closed (legacy)', () => {
            expect(isValidSuiteTransition('rejected', 'closed')).toBe(true);
        });

        it('edit → current', () => {
            expect(isValidSuiteTransition('edit', 'current')).toBe(true);
        });

        it('edit → pending_review', () => {
            expect(isValidSuiteTransition('edit', 'pending_review')).toBe(true);
        });

        it('edit → superseded', () => {
            expect(isValidSuiteTransition('edit', 'superseded')).toBe(true);
        });

        it('dispatched → pending_review', () => {
            expect(isValidSuiteTransition('dispatched', 'pending_review')).toBe(true);
        });

        it('dispatched → closed', () => {
            expect(isValidSuiteTransition('dispatched', 'closed')).toBe(true);
        });
    });

    describe('terminal states', () => {
        it('superseded é terminal', () => {
            expect(isTerminalSuiteStatus('superseded')).toBe(true);
        });

        it('closed é terminal', () => {
            expect(isTerminalSuiteStatus('closed')).toBe(true);
        });

        it('terminal não permite transições', () => {
            for (const terminal of ['superseded', 'closed'] as SuiteStatus[]) {
                for (const target of allStatuses) {
                    expect(isValidSuiteTransition(terminal, target)).toBe(false);
                }
            }
        });
    });

    describe('self-transitions', () => {
        it('não permite self-transição em estado não-terminal', () => {
            expect(isValidSuiteTransition('draft', 'draft')).toBe(false);
            expect(isValidSuiteTransition('current', 'current')).toBe(false);
            expect(isValidSuiteTransition('pending_review', 'pending_review')).toBe(false);
        });
    });

    describe('cobertura completa', () => {
        it('11 estados definidos', () => {
            expect(allStatuses.length).toBe(11);
        });

        it('todos estados têm pelo menos 1 transição ou são terminais', () => {
            const validTransitions: Record<string, number> = {};
            for (const from of allStatuses) {
                let count = 0;
                for (const to of allStatuses) {
                    if (isValidSuiteTransition(from, to)) count++;
                }
                validTransitions[from] = count;
            }

            // Verify each non-terminal has transitions, each terminal has 0
            expect(validTransitions.draft).toBeGreaterThan(0);
            expect(validTransitions.current).toBeGreaterThan(0);
            expect(validTransitions.edit).toBeGreaterThan(0);
            expect(validTransitions.locked).toBe(1); // only → current
            expect(validTransitions.dispatched).toBeGreaterThan(0);
            expect(validTransitions.pending_review).toBeGreaterThan(0);
            expect(validTransitions.refuted).toBeGreaterThan(0);
            expect(validTransitions.approved).toBeGreaterThan(0);
            expect(validTransitions.rejected).toBeGreaterThan(0);
            expect(validTransitions.superseded).toBe(0);
            expect(validTransitions.closed).toBe(0);
        });
    });
});
