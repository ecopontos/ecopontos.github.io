import { afterEach, describe, expect, it } from 'vitest';
import { CapacitorSqliteAdapter } from '../js/adapters/CapacitorSqliteAdapter.js';
import { registerAllHandlers } from '../js/sync/HandlerRegistry.js';

function makeFakeSqlite() {
  const calls = [];
  return {
    calls,
    async execute(sql, params = []) {
      calls.push({ kind: 'execute', sql, params });
    },
    async query(sql, params = []) {
      calls.push({ kind: 'query', sql, params });
      return [];
    },
    async all(sql, params = []) {
      calls.push({ kind: 'all', sql, params });
      return [];
    },
    async transaction(callback) {
      return callback(this);
    },
  };
}

function registeredHandlers() {
  const handlers = new Map();
  registerAllHandlers({
    onInbound(type, handler) {
      handlers.set(type, handler);
    },
  });
  return handlers;
}

describe('mobile SQLite sync', () => {
  afterEach(() => {
    delete globalThis.Capacitor;
  });

  it('passes a SqlitePort-compatible tx to transaction callbacks', async () => {
    const adapter = new CapacitorSqliteAdapter();
    const calls = [];
    globalThis.Capacitor = {
      Plugins: {
        CapacitorSQLite: {
          createConnection: async () => { calls.push('createConnection'); },
          open: async () => { calls.push('open'); },
          beginTransaction: async () => { calls.push('begin'); },
          commitTransaction: async () => { calls.push('commit'); },
          rollbackTransaction: async () => { calls.push('rollback'); },
        },
      },
    };

    let txSeen;
    await adapter.transaction(async (tx) => {
      txSeen = tx;
    });

    expect(txSeen).toBe(adapter);
    expect(calls).toEqual(['createConnection', 'open', 'begin', 'commit']);
  });

  it('handles demanda.criada with SQLite writes to demandas', async () => {
    const handlers = registeredHandlers();
    const db = makeFakeSqlite();

    await handlers.get('demanda.criada')({
      type: 'demanda.criada',
      time: '2026-07-01T12:00:00.000Z',
      aggregate: { id: 'dem-1' },
      data: {
        origem_tipo: 'form',
        origem_id: 'pacote-1',
        solicitante_id: 'setor-a',
        destinatario_id: 'setor-b',
        descricao: 'Solicitacao',
      },
    }, db);

    expect(db.calls[0].kind).toBe('execute');
    expect(db.calls[0].sql).toContain('INSERT INTO demandas');
    expect(db.calls[0].sql).not.toContain('tbl_demandas');
    expect(db.calls[0].params[0]).toBe('dem-1');
  });

  it('stores legacy module events in registro_dados instead of missing tbl_modulos', async () => {
    const handlers = registeredHandlers();
    const db = makeFakeSqlite();

    await handlers.get('module.publicado')({
      type: 'module.publicado',
      time: '2026-07-01T12:00:00.000Z',
      aggregate: { id: 'mod-1' },
      data: { id: 'mod-1', slug: 'vistoria', name: 'Vistoria', status: 'published' },
    }, db);

    expect(db.calls[0].kind).toBe('execute');
    expect(db.calls[0].sql).toContain('INSERT INTO registro_dados');
    expect(db.calls[0].sql).not.toContain('tbl_modulos');
    expect(db.calls[0].params[1]).toBe('module');
  });
  it('registers desktop-only inbound events as registro_dados fallback writes', async () => {
    const handlers = registeredHandlers();
    const db = makeFakeSqlite();

    await handlers.get('agendamento.criado')({
      type: 'agendamento.criado',
      time: '2026-07-01T12:00:00.000Z',
      aggregate: { id: 'ag-1' },
      data: { id: 'ag-1', cliente_nome: 'Cliente' },
    }, db);

    expect(db.calls[0].kind).toBe('execute');
    expect(db.calls[0].sql).toContain('INSERT INTO registro_dados');
    expect(db.calls[0].params[1]).toBe('agendamento');
    expect(db.calls[0].params[2]).toBe('ag-1');
  });
});
