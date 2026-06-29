import { invoke } from '@tauri-apps/api/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TauriSqliteAdapter } from '../tauriSqliteAdapter';

vi.mock('@tauri-apps/api/core', () => ({
    invoke: vi.fn(),
}));

function deferred<T = void>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

describe('TauriSqliteAdapter transactions', () => {
    const invokeMock = vi.mocked(invoke);

    beforeEach(() => {
        invokeMock.mockReset();
        invokeMock.mockResolvedValue({});
    });

    it('executa transactionBatch pelo comando Rust db_transaction', async () => {
        const adapter = new TauriSqliteAdapter();
        const statements = [
            { sql: 'DELETE FROM permissoes_modulos WHERE module_id = ?', params: ['mod-1'] },
            { sql: 'INSERT INTO permissoes_modulos (module_id, perfil) VALUES (?, ?)', params: ['mod-1', 'admin'] },
        ];

        await adapter.transactionBatch(statements, { bootstrap: true });

        expect(invokeMock).toHaveBeenCalledTimes(1);
        expect(invokeMock).toHaveBeenCalledWith('db_transaction', {
            statements,
            bootstrap: true,
        });
    });

    it('serializa operacoes concorrentes enquanto uma transacao callback esta aberta', async () => {
        const calls: string[] = [];
        invokeMock.mockImplementation(async (command, args) => {
            const payload = args as { sql?: string } | undefined;
            calls.push(payload?.sql ?? command);
            return {};
        });

        const adapter = new TauriSqliteAdapter();
        const transactionReady = deferred();
        const releaseTransaction = deferred();

        const transactionPromise = adapter.transaction(async (tx) => {
            await tx.execute('INSERT INTO eventos(id) VALUES (?)', ['tx']);
            transactionReady.resolve();
            await releaseTransaction.promise;
        });

        await transactionReady.promise;
        const outsidePromise = adapter.execute('INSERT INTO eventos(id) VALUES (?)', ['outside']);

        await Promise.resolve();
        await Promise.resolve();

        expect(calls).toEqual([
            'BEGIN TRANSACTION',
            'INSERT INTO eventos(id) VALUES (?)',
        ]);

        releaseTransaction.resolve();
        await Promise.all([transactionPromise, outsidePromise]);

        expect(calls).toEqual([
            'BEGIN TRANSACTION',
            'INSERT INTO eventos(id) VALUES (?)',
            'COMMIT',
            'INSERT INTO eventos(id) VALUES (?)',
        ]);
    });

    it('serializa transacoes callback entre instancias diferentes do adapter', async () => {
        const calls: string[] = [];
        invokeMock.mockImplementation(async (command, args) => {
            const payload = args as { sql?: string } | undefined;
            calls.push(payload?.sql ?? command);
            return {};
        });

        const adapterA = new TauriSqliteAdapter();
        const adapterB = new TauriSqliteAdapter();
        const transactionReady = deferred();
        const releaseTransaction = deferred();

        const transactionPromise = adapterA.transaction(async (tx) => {
            await tx.execute('INSERT INTO eventos(id) VALUES (?)', ['tx']);
            transactionReady.resolve();
            await releaseTransaction.promise;
        });

        await transactionReady.promise;
        const outsidePromise = adapterB.execute('INSERT INTO eventos(id) VALUES (?)', ['outside']);

        await Promise.resolve();
        await Promise.resolve();

        expect(calls).toEqual([
            'BEGIN TRANSACTION',
            'INSERT INTO eventos(id) VALUES (?)',
        ]);

        releaseTransaction.resolve();
        await Promise.all([transactionPromise, outsidePromise]);

        expect(calls).toEqual([
            'BEGIN TRANSACTION',
            'INSERT INTO eventos(id) VALUES (?)',
            'COMMIT',
            'INSERT INTO eventos(id) VALUES (?)',
        ]);
    });

});
