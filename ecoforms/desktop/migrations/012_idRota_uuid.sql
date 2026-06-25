-- Migration 012: Change idRota from INTEGER to TEXT (UUID) — ADR-012
-- Preserves existing data: numeric IDs become text

-- 1. Create new table with TEXT idRota
CREATE TABLE IF NOT EXISTS tblRotas_new (
    idRota TEXT NOT NULL PRIMARY KEY,
    idPJ TEXT,
    idRoteiro INTEGER,
    Ordem DOUBLE,
    Inativo BOOLEAN DEFAULT 0,
    FOREIGN KEY (idPJ) REFERENCES pjuridicas(uuid)
);

-- 2. Migrate existing data (cast INTEGER to TEXT)
INSERT OR IGNORE INTO tblRotas_new (idRota, idPJ, idRoteiro, Ordem, Inativo)
SELECT CAST(idRota AS TEXT), idPJ, idRoteiro, Ordem, Inativo FROM rotas;

-- 3. Drop old table
DROP TABLE IF EXISTS rotas;

-- 4. Rename new table
ALTER TABLE tblRotas_new RENAME TO rotas;
