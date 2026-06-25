/**
 * Executável para arquivamento de Histórico Morto da suite para arquivos Parquet,
 * utilizando o DuckDB.
 * O objetivo é esfriar o cache SQLite varrendo registros finalizados (status = 'closed'|'superseded').
 *
 * Utilização Node.js
 * npm install duckdb sqlite3 --save
 */

import Database from 'sqlite3';
import duckdb_pkg from 'duckdb';
const DuckDB = duckdb_pkg.Database;
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Caminhos padrão
const SQLITE_DB_PATH = join(process.cwd(), 'desktop', 'ecoforms_local_desktop.db');
const ARCHIVE_DIR = join(process.cwd(), 'archive', 'parquet');

if (!existsSync(ARCHIVE_DIR)) {
  mkdirSync(ARCHIVE_DIR, { recursive: true });
}

// Inicializa DuckDB local transitório (em memória ou em disco leve)
const duckdb = new DuckDB(':memory:');

// Cliente SQLite
const sqlite = new Database.Database(SQLITE_DB_PATH);

interface SuiteRow {
  package_id: string;
  module_type: string;
  resource_type: string;
  status: string;
  payload_json: string;
  closed_at: string;
}

/**
 * Função principal do Archive Pipeline
 */
async function runArchivePipeline() {
  console.log(`[Archive] Iniciando varredura da suite do SQLite...`);

  // Define os critérios de retenção: Exemplo: Fechado e com closed_at anterior a X dias. 
  // Por ora, vamos pegar todos que estão fechados/substituídos para a migração / archive imediato.
  const query = `
    SELECT package_id, module_type, resource_type, status, payload_json, closed_at 
    FROM suite 
    WHERE status IN ('closed', 'superseded')
  `;

  sqlite.all(query, [], (err, rows: SuiteRow[]) => {
    if (err) {
      console.error('[Archive] Erro ao pesquisar no SQLite:', err);
      process.exit(1);
    }

    if (rows.length === 0) {
      console.log(`[Archive] Nenhum registro elegível para arquivamento encontrado.`);
      process.exit(0);
    }

    console.log(`[Archive] Encontrados ${rows.length} registros para esfriar.`);

    const currentDate = new Date().toISOString().split('T')[0];
    const outputFile = join(ARCHIVE_DIR, `history_${currentDate}.parquet`);

    // Registra uma conexão com DuckDB e passa os dados JSON localmente
    duckdb.all(`
      INSTALL sqlite;
      LOAD sqlite;
      
      -- Importa diretamente os registros selecionados do SQLite local 
      -- e escreve no formato Parquet via DuckDB.
      
      COPY (
          SELECT 
              package_id, 
              version_no, 
              module_type, 
              resource_type, 
              status, 
              owner_id, 
              created_at, 
              closed_at,
              payload_json
          FROM sqlite_scan('${SQLITE_DB_PATH.replace(/\\/g, '/')}', 'suite')
          WHERE status IN ('closed', 'superseded')
      ) TO '${outputFile.replace(/\\/g, '/')}' (FORMAT PARQUET, COMPRESSION ZSTD);
    `, (duckErr) => {
      if (duckErr) {
        console.error('[Archive] Falha ao exportar Parquet via DuckDB:', duckErr);
        // Fallback or exit
        process.exit(1);
      }

      console.log(`[Archive] Arquivo Parquet gerado com sucesso em: ${outputFile}`);

      // Expurgo do SQLite
      const idsToDelete = rows.map(r => r.package_id);
      const deletePlaceholders = idsToDelete.map(() => '?').join(',');
      
      sqlite.run(`DELETE FROM suite WHERE package_id IN (${deletePlaceholders})`, idsToDelete, function (delErr) {
        if (delErr) {
          console.error('[Archive] Erro ao deletar registros archivados do SQLite:', delErr);
        } else {
          console.log(`[Archive] ${this.changes} pacotes deletados do SQLite (esfriamento concluído).`);
        }
        
        sqlite.close();
        process.exit(0);
      });
    });
  });
}

runArchivePipeline();
