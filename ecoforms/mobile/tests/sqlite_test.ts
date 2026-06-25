import sqlite3Pkg from 'sqlite3';
const { Database } = sqlite3Pkg;
import { join } from 'path';
import * as Migrations from '../desktop/lib/normalization/migrations';
import type { SQLiteDBWrapper } from '../desktop/lib/normalization/db-wrapper';

// Helper igual ao de migrations.ts para evitar quebrar triggers no ;
function splitSqlStatements(sql: string): string[] {
    const res: string[] = [];
    let cur = '';
    let depth = 0;
    const lines = sql.replace(/\r\n/g, '\n').split('\n');

    for (const line of lines) {
        const cleanLine = line.replace(/--.*$/, '').trim();
        if (!cleanLine) {
            if (cur.trim()) cur += '\n' + line;
            continue;
        }
        const up = cleanLine.toUpperCase();
        depth += (up.match(/\bBEGIN\b/g) || []).length - (up.match(/\bEND\b/g) || []).length;
        cur += (cur ? '\n' : '') + line;
        if (depth === 0 && cleanLine.endsWith(';')) {
            res.push(cur);
            cur = '';
        }
    }
    if (cur.trim()) res.push(cur);
    return res;
}
import { rmSync, existsSync } from 'fs';

const DB_PATH = join(process.cwd(), 'desktop', 'ecoforms_local_desktop.db');

async function testViews() {
  if (existsSync(DB_PATH)) {
    rmSync(DB_PATH);
  }
  
  const sqlite = new Database(DB_PATH);
  
  const dbWrapper: SQLiteDBWrapper = {
    exec: (sql: string) => new Promise((res, rej) => {
        const statements = splitSqlStatements(sql).filter(s => s.trim().length > 0);
        let current = Promise.resolve();
        for (const s of statements) {
            current = current.then(() => new Promise((r, rj) => sqlite.run(s, (err) => err ? rj(err) : r())));
        }
        current.then(() => res()).catch(rej);
    }),
    all: (sql: string, params: any[] = []) => new Promise((res, rej) => sqlite.all(sql, params, (err, rows) => err ? rej(err) : res(rows))),
    get: (sql: string, params: any[] = []) => new Promise((res, rej) => sqlite.get(sql, params, (err, row) => err ? rej(err) : res(row))),
    run: (sql: string, params: any[] = []) => new Promise((res, rej) => sqlite.run(sql, params, function(err) { err ? rej(err) : res(this) })),
  };

  console.log('🔄 Executando Migrations...');
  await Migrations.migrateNormalizationSchema(dbWrapper);
  
  console.log('🔄 Populando pacotes mock na suite...');
  await dbWrapper.run(`
    INSERT INTO suite (package_id, module_type, resource_type, status, payload_json) 
    VALUES 
    ('1', 'ouvidoria', 'protocolo', 'dispatched', '{"snapshot_dims": {"cliente": {"nome": "Maria Silva"}}, "payload": {"classificacao": {"gravidade": "alta"}}, "execution": {"data_vencimento": "2026-04-10T10:00:00.000Z", "atribuido_para": "setor-limpeza"}}'),
    ('2', 'ouvidoria', 'protocolo', 'closed', '{"snapshot_dims": {"cliente": {"nome": "João Souza"}}, "payload": {"classificacao": {"gravidade": "media"}}, "execution": {"data_vencimento": "2026-04-01T10:00:00.000Z", "atribuido_para": "setor-limpeza"}}')
  `);
  
  console.log('🔄 Executando select na view nova vw_ouvidoria_por_setor...');
  const res = await dbWrapper.all(`SELECT * FROM vw_ouvidoria_por_setor`);
  console.log('Result:', JSON.stringify(res, null, 2));
  
  console.log('🔄 Executando select na view nova vw_ouvidoria_current...');
  const res2 = await dbWrapper.all(`SELECT * FROM vw_ouvidoria_current`);
  console.log('Result 2:', JSON.stringify(res2, null, 2));

  sqlite.close();
}

testViews().catch(console.error);