-- Adiciona colunas id_externo e sigla à tabela tipos_residuo para suportar
-- a sincronização com comcap.cad_residuo (PostgreSQL externo).
-- Seguro para instâncias que já possuem as colunas (ensure-columns as adiciona via ALTER TABLE).

ALTER TABLE tipos_residuo ADD COLUMN id_externo INTEGER;
ALTER TABLE tipos_residuo ADD COLUMN sigla TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_residuo_id_externo
    ON tipos_residuo(id_externo) WHERE id_externo IS NOT NULL;
