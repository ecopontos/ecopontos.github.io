import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSeedDemo } from './useSeedDemo';
import { getContainerAsync } from '../utils/useContainer';

vi.mock('../utils/useContainer', () => ({
    getContainerAsync: vi.fn(),
}));

describe('useSeedDemo', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('usa a coluna can?nica residuo ao criar roteiro demo', async () => {
        const execute = vi.fn(async (_sql: string, _params?: unknown[]) => {});
        const query = vi.fn(async (sql: string) => {
            if (sql.startsWith('SELECT COUNT(*) as count FROM')) {
                return [{ count: 0 }];
            }
            if (sql === 'SELECT id FROM clientes LIMIT 1') {
                return [{ id: 'cliente-1' }];
            }
            return [];
        });
        vi.mocked(getContainerAsync).mockResolvedValue({
            sqlite: { query, execute },
        } as never);

        const { result } = renderHook(() => useSeedDemo());

        await act(async () => {
            await result.current.seed();
        });

        await waitFor(() => {
            expect(execute).toHaveBeenCalled();
        });

        const roteiroInsert = vi.mocked(execute).mock.calls.find(([sql]) =>
            typeof sql === 'string' && sql.startsWith('INSERT INTO roteiros'),
        );
        expect(roteiroInsert).toBeDefined();
        expect(roteiroInsert?.[0]).toContain('residuo');
        expect(roteiroInsert?.[0]).not.toContain('tipo_residuo');
    });
});
