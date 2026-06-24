-- Adiciona coluna 'residuo' à tabela roteiros para armazenar a descrição
-- do resíduo vinda do PostgreSQL externo (comcap.cad_residuo.descricao).
-- Coluna já existente em installs novos via ensure-columns; esta migration
-- cobre installs legados que já possuem a tabela sem a coluna.

ALTER TABLE roteiros ADD COLUMN residuo TEXT;
