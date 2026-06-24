/**
 * Catálogo de queries: Data Registry
 *
 * Agregações sobre o registro de dados dinâmico (registro_dados).
 * Estas queries são as bases para medidas implícitas geradas pelo
 * ImplicitCalcEngine quando não existe uma query pré-formatada específica.
 */
import type { QueryDef } from './_types';

export const REGISTRY_CONTAGEM_POR_TIPO: QueryDef = {
  sql: `
    SELECT
        tipo,
        COUNT(*) AS total
    FROM registro_dados
    GROUP BY tipo
    ORDER BY total DESC
  `,
  description: 'Contagem de registros por tipo no data registry',
  params: [],
  use: 'medida',
  returns: '{ tipo, total }[]',
};

export const DATA_REGISTRY_TIPOS_COUNT: QueryDef = {
  sql: `SELECT tipo, COUNT(*) as count FROM data_registry GROUP BY tipo ORDER BY tipo`,
  description: 'Contagem de registros por tipo na tabela data_registry (para selects de catálogo no wizard de módulos)',
  params: [],
  use: 'operacional',
  returns: '{ tipo, count }[]',
};

export const REGISTRY_ITENS_POR_TIPO: QueryDef = {
  sql: `
    SELECT id, tipo, conteudo, criado_em, atualizado_em
    FROM registro_dados
    WHERE tipo = ?
    ORDER BY criado_em DESC
    LIMIT ?
  `,
  description: 'Itens do data registry por tipo, do mais recente ao mais antigo',
  params: ['tipo', 'limite'],
  use: 'operacional',
  returns: '{ id, tipo, conteudo, criado_em, atualizado_em }[]',
};

export const REGISTRY_TENDENCIA_MENSAL: QueryDef = {
  sql: `
    SELECT
        tipo,
        strftime('%Y-%m', criado_em) AS mes,
        COUNT(*)                      AS total
    FROM registro_dados
    WHERE tipo = ?
      AND criado_em >= date('now', ? || ' months')
    GROUP BY mes
    ORDER BY mes ASC
  `,
  description: 'Tendência mensal de registros de um tipo nos últimos N meses',
  params: ['tipo', 'meses_atras'],
  use: 'dashboard',
  returns: '{ tipo, mes, total }[]',
};

export const REGISTRY_CAMPO_DISTRIBUICAO: QueryDef = {
  sql: `
    SELECT
        json_extract(conteudo, ?) AS valor,
        COUNT(*)                   AS total
    FROM registro_dados
    WHERE tipo = ?
      AND json_extract(conteudo, ?) IS NOT NULL
    GROUP BY valor
    ORDER BY total DESC
    LIMIT 20
  `,
  description: 'Distribuição de valores de um campo JSON no data registry (para medidas implícitas de campos select/texto)',
  params: ['json_path', 'tipo', 'json_path'],
  use: 'medida',
  returns: '{ valor, total }[]',
};

export const REGISTRY_CAMPO_SOMA: QueryDef = {
  sql: `
    SELECT
        COALESCE(SUM(CAST(json_extract(conteudo, ?) AS REAL)), 0) AS soma,
        COALESCE(AVG(CAST(json_extract(conteudo, ?) AS REAL)), 0) AS media,
        COUNT(*)                                                   AS total_registros
    FROM registro_dados
    WHERE tipo = ?
      AND json_extract(conteudo, ?) IS NOT NULL
  `,
  description: 'Soma e média de um campo numérico JSON no data registry (para medidas implícitas de campos numéricos)',
  params: ['json_path', 'json_path', 'tipo', 'json_path'],
  use: 'medida',
  returns: '{ soma, media, total_registros }',
};
