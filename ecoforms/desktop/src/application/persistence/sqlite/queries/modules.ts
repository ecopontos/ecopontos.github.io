import type { QueryDef } from './_types';

const REGISTRO_MODULOS_COLUNAS = `
  id, slug, nome, descricao, tipo_entidade, icon, color, prefix, ordem,
  status, versao, config_version, configuracao, config_suite,
  criado_em, atualizado_em, publicado_em
`;

export const MODULO_POR_ID: QueryDef = {
  sql: `SELECT ${REGISTRO_MODULOS_COLUNAS} FROM registro_modulos WHERE id = ? LIMIT 1`,
  description: 'Modulo por ID',
  params: ['id'],
  use: 'operacional',
  returns: '{ id, slug, nome, descricao, tipo_entidade, icon, color, prefix, ordem, status, versao, config_version, configuracao, config_suite, criado_em, atualizado_em, publicado_em }',
};

export const MODULO_REGISTRY_POR_SLUG: QueryDef = {
  sql: `SELECT ${REGISTRO_MODULOS_COLUNAS} FROM registro_modulos WHERE slug = ? LIMIT 1`,
  description: 'Modulo do registry por slug, independente do status',
  params: ['slug'],
  use: 'operacional',
  returns: MODULO_POR_ID.returns,
};

export const MODULO_POR_TIPO_ENTIDADE: QueryDef = {
  sql: `SELECT ${REGISTRO_MODULOS_COLUNAS} FROM registro_modulos WHERE tipo_entidade = ? LIMIT 1`,
  description: 'Modulo por tipo de entidade',
  params: ['tipo_entidade'],
  use: 'operacional',
  returns: MODULO_POR_ID.returns,
};

export const MODULOS_TODOS: QueryDef = {
  sql: `SELECT ${REGISTRO_MODULOS_COLUNAS} FROM registro_modulos ORDER BY ordem ASC`,
  description: 'Todos os modulos ordenados',
  params: [],
  use: 'operacional',
  returns: `${MODULO_POR_ID.returns}[]`,
};

export const MODULOS_POR_STATUS: QueryDef = {
  sql: `SELECT ${REGISTRO_MODULOS_COLUNAS} FROM registro_modulos WHERE status = ? ORDER BY ordem ASC`,
  description: 'Modulos filtrados por status',
  params: ['status'],
  use: 'operacional',
  returns: MODULOS_TODOS.returns,
};

export const MODULO_POR_SLUG: QueryDef = {
  sql: `SELECT id, slug, nome, tipo_entidade, configuracao FROM registro_modulos WHERE slug = ? AND status = 'published' LIMIT 1`,
  description: 'Modulo publicado por slug',
  params: ['slug'],
  use: 'operacional',
  returns: '{ id, slug, nome, tipo_entidade, configuracao }',
};

export const MODULO_TIPO_ENTIDADE_PUBLICADO: QueryDef = {
  sql: `SELECT tipo_entidade FROM registro_modulos WHERE slug = ? AND status = 'published' LIMIT 1`,
  description: 'Tipo de entidade de modulo publicado por slug',
  params: ['slug'],
  use: 'operacional',
  returns: '{ tipo_entidade }',
};

export const DASHBOARD_WIDGETS: QueryDef = {
  sql: `SELECT widgets FROM registro_visualizacoes WHERE id = ? LIMIT 1`,
  description: 'Widgets de um dashboard por ID',
  params: ['id'],
  use: 'operacional',
  returns: '{ widgets }',
};

export const PERMISSOES_MODULO: QueryDef = {
  sql: `SELECT profile, can_view, can_create, can_edit, can_approve, can_delete FROM permissoes_modulos WHERE module_id = ?`,
  description: 'Permissoes por modulo',
  params: ['module_id'],
  use: 'operacional',
  returns: '{ profile, can_view, can_create, can_edit, can_approve, can_delete }[]',
};

export function FORMULARIOS_MODULO_POR_IDS(placeholders: string): QueryDef {
  return {
    sql: `SELECT form_id, titulo, conteudo FROM registro_formularios WHERE form_id IN (${placeholders})`,
    description: 'Formularios referenciados por modulo',
    params: ['form_ids'],
    use: 'operacional',
    returns: '{ form_id, titulo, conteudo }[]',
  };
}

export function ITENS_CATALOGOS_MODULO_POR_TIPOS(placeholders: string): QueryDef {
  return {
    sql: `
      SELECT id, tipo, chave, conteudo, versao, criado_em, atualizado_em
      FROM registro_dados
      WHERE tipo IN (${placeholders})
      ORDER BY tipo ASC, json_extract(conteudo, '$.nome') ASC
    `,
    description: 'Itens de catalogos de dados referenciados por modulo',
    params: ['tipos'],
    use: 'operacional',
    returns: '{ id, tipo, chave, conteudo, versao, criado_em, atualizado_em }[]',
  };
}

export function VISUALIZACOES_MODULO_POR_IDS(placeholders: string): QueryDef {
  return {
    sql: `SELECT id, titulo, perfis, layout, widgets, tipo_modulo AS module_type, id_usuario AS user_id, modelo AS is_template, ativo, criado_em, atualizado_em
         FROM registro_visualizacoes WHERE id IN (${placeholders}) AND ativo = 1`,
    description: 'Visualizacoes referenciadas por modulo',
    params: ['ids'],
    use: 'operacional',
    returns: '{ id, titulo, perfis, layout, widgets, module_type, user_id, is_template, ativo, criado_em, atualizado_em }[]',
  };
}

export function DECISOES_MODULO_POR_IDS(placeholders: string): QueryDef {
  return {
    sql: `SELECT id, tipo_alvo AS target_type, acao AS action, perfis, ativado_quando AS enabled_when,
                passos AS steps, parametros AS params, tipo_consequencia AS consequence_type,
                padrao_consequencia AS consequence_pattern, config_consequencia AS consequence_config,
                ativo, criado_em, atualizado_em
         FROM registro_decisoes WHERE id IN (${placeholders}) AND ativo = 1`,
    description: 'Decisoes referenciadas por modulo',
    params: ['ids'],
    use: 'operacional',
    returns: '{ id, target_type, action, perfis, enabled_when, steps, params, consequence_type, consequence_pattern, consequence_config, ativo, criado_em, atualizado_em }[]',
  };
}
