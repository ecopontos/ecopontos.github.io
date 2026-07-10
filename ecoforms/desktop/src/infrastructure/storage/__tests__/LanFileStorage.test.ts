import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

// Mock do invoke do Tauri — LanFileStorage importa dinamicamente @tauri-apps/api/core.
const invokeMock = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
    invoke: (cmd: string, args: { path: string; content: string }) => invokeMock(cmd, args),
}));

import { LanFileStorage } from '../LanFileStorage';

/** SqlitePort fake que só responde à query de lan_sync_path. */
function makeSqlite(lanPath: string): SqlitePort {
    return {
        query: vi.fn(async (sql: string) => {
            if (/configuracoes_sistema/.test(sql) && /lan_sync_path/.test(sql)) {
                return lanPath ? [{ valor: lanPath }] : [];
            }
            return [];
        }) as SqlitePort['query'],
        execute: vi.fn(async () => {}),
    } as unknown as SqlitePort;
}

describe('LanFileStorage.writeFile', () => {
    beforeEach(() => {
        invokeMock.mockReset();
    });

    it('é no-op quando lan_sync_path vazio', async () => {
        const storage = new LanFileStorage(makeSqlite(''));
        await storage.writeFile('shared/test.json', new TextEncoder().encode('{}'));
        expect(invokeMock).not.toHaveBeenCalled();
    });

    it('propaga erro de invoke e loga warning', async () => {
        const storage = new LanFileStorage(makeSqlite('/tmp/lan'));
        const writeErr = new Error('disk full');
        invokeMock.mockRejectedValue(writeErr);
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(storage.writeFile('shared/x.json', new Uint8Array([1, 2, 3]))).rejects.toThrow('disk full');

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('[LanFileStorage] write failed'),
            'shared/x.json',
            writeErr,
        );
        warnSpy.mockRestore();
    });

    it('escreve com sucesso quando invoke resolve', async () => {
        const storage = new LanFileStorage(makeSqlite('/tmp/lan'));
        invokeMock.mockResolvedValue(undefined);

        await expect(storage.writeFile('shared/ok.json', new Uint8Array([1, 2, 3]))).resolves.toBeUndefined();
        expect(invokeMock).toHaveBeenCalledTimes(1);
        // [0] = cmd, [1] = args
        expect(invokeMock.mock.calls[0][0]).toBe('lan_write_file');
        expect(invokeMock.mock.calls[0][1].path).toBe('shared/ok.json');
    });
});
