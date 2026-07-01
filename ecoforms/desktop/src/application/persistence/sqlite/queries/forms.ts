import type { QueryDef } from './_types';

export const FORM_DEFINITION_ATIVO: QueryDef = {
  sql: `SELECT conteudo FROM registro_formularios WHERE form_id = ? AND ativo = 1 LIMIT 1`,
  description: 'Conteúdo de um formulário ativo por form_id',
  params: ['form_id'],
  use: 'operacional',
  returns: '{ conteudo }',
};

export const FORM_DEFINITION: QueryDef = {
  sql: `SELECT conteudo FROM registro_formularios WHERE form_id = ? LIMIT 1`,
  description: 'Conteúdo de um formulário por form_id (independente de ativo)',
  params: ['form_id'],
  use: 'operacional',
  returns: '{ conteudo }',
};

export const FORMS_ATIVOS: QueryDef = {
  sql: `SELECT form_id, titulo, conteudo FROM registro_formularios WHERE ativo = 1`,
  description: 'Lista de formulários ativos com conteúdo',
  params: [],
  use: 'operacional',
  returns: '{ form_id, titulo, conteudo }[]',
};

export const FORM_METADATA: QueryDef = {
  sql: `SELECT auto_aprovacao, ad_hoc FROM registro_formularios WHERE form_id = ? LIMIT 1`,
  description: 'Metadados de auto-aprovação e ad-hoc de um formulário',
  params: ['form_id'],
  use: 'operacional',
  returns: '{ auto_aprovacao, ad_hoc }',
};

export const FORM_REGISTRY_LIST_ATIVOS: QueryDef = {
  sql: `SELECT * FROM registro_formularios WHERE ativo = 1 ORDER BY criado_em DESC`,
  description: 'Lista de formulários ativos no registro',
  params: [],
  use: 'operacional',
  returns: 'FormRegistry[]',
};

export const FORM_REGISTRY_LIST_ALL: QueryDef = {
  sql: `SELECT * FROM registro_formularios ORDER BY ativo DESC, criado_em DESC`,
  description: 'Lista de todos os formulários no registro (incluindo inativos)',
  params: [],
  use: 'operacional',
  returns: 'FormRegistry[]',
};

export const FORM_REGISTRY_SOFT_DELETE: QueryDef = {
  sql: `UPDATE registro_formularios SET ativo = 0, atualizado_em = datetime('now') WHERE form_id = ?`,
  description: 'Desativa um formulário (soft delete)',
  params: ['form_id'],
  use: 'operacional',
  returns: 'void',
};

export const FORM_REGISTRY_RESTORE: QueryDef = {
  sql: `UPDATE registro_formularios SET ativo = 1, atualizado_em = datetime('now') WHERE form_id = ?`,
  description: 'Reativa um formulário',
  params: ['form_id'],
  use: 'operacional',
  returns: 'void',
};

export const FORM_REGISTRY_GET: QueryDef = {
  sql: `SELECT * FROM registro_formularios WHERE form_id = ?`,
  description: 'Obtém um formulário do registro por ID',
  params: ['form_id'],
  use: 'operacional',
  returns: 'FormRegistry',
};

export const FORMS_ATIVOS_LIST: QueryDef = {
  sql: `SELECT form_id, titulo FROM registro_formularios WHERE ativo = 1 ORDER BY titulo ASC`,
  description: 'Lista de formulários ativos (form_id + titulo) para selects e dropdowns',
  params: [],
  use: 'operacional',
  returns: '{ form_id, titulo }[]',
};

export const FORMS_ATIVOS_PRESETS: QueryDef = {
  sql: `SELECT form_id, slug, titulo FROM registro_formularios WHERE ativo = 1 ORDER BY titulo ASC`,
  description: 'Lista de formulários ativos com slug (fallback de form_id) — para NewTaskModal',
  params: [],
  use: 'operacional',
  returns: '{ form_id, slug, titulo }[]',
};

export const FORMS_SCHEMAS_ATIVOS: QueryDef = {
  sql: `SELECT form_id, conteudo FROM registro_formularios WHERE ativo = 1`,
  description: 'Schemas (conteúdo JSON) de todos os formulários ativos — indexados por form_id',
  params: [],
  use: 'operacional',
  returns: '{ form_id, conteudo }[]',
};

export const FORM_REGISTRY_GET_BY_ID_OR_SLUG: QueryDef = {
  sql: `SELECT * FROM registro_formularios WHERE form_id = ? OR slug = ? LIMIT 1`,
  description: 'Obtém um formulário do registro por form_id ou slug (busca combinada, app/forms/edit)',
  params: ['form_id', 'slug'],
  use: 'operacional',
  returns: 'FormRegistry',
};

export const FORM_REGISTRY_UPDATE: QueryDef = {
  sql: `UPDATE registro_formularios SET
  titulo = ?,
  versao = ?,
  conteudo = ?,
  atualizado_em = ?,
  slug = ?,
  ativo = ?,
  auto_aprovacao = ?,
  ad_hoc = ?,
  data_id = ?
 WHERE form_id = ?`,
  description: 'Atualiza um registro de formulário existente (SchemaEditor — update branch)',
  params: [
    'titulo', 'versao', 'conteudo', 'atualizado_em', 'slug', 'ativo',
    'auto_aprovacao', 'ad_hoc', 'data_id', 'form_id',
  ],
  use: 'operacional',
  returns: 'void',
};

export const FORM_REGISTRY_INSERT: QueryDef = {
  sql: `INSERT INTO registro_formularios
 (form_id, titulo, versao, conteudo,
  criado_em, atualizado_em, slug, ativo, auto_aprovacao, ad_hoc, data_id)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  description: 'Insere um novo registro de formulário (SchemaEditor — insert branch)',
  params: [
    'form_id', 'titulo', 'versao', 'conteudo',
    'criado_em', 'atualizado_em', 'slug', 'ativo', 'auto_aprovacao', 'ad_hoc', 'data_id',
  ],
  use: 'operacional',
  returns: 'void',
};

export const FORM_REGISTRY_CLONE_INSERT: QueryDef = {
  sql: `INSERT INTO registro_formularios
 (form_id, titulo, slug, conteudo, versao, ativo, autor, criado_em, atualizado_em, auto_aprovacao, ad_hoc)
 VALUES (?, ?, ?, ?, ?, 1, ?, datetime('now'), datetime('now'), ?, ?)`,
  description: 'Insere um clone de formulário (useFormRegistryData clone)',
  params: [
    'new_form_id', 'new_titulo', 'new_slug', 'conteudo', 'versao',
    'autor', 'auto_aprovacao', 'ad_hoc',
  ],
  use: 'operacional',
  returns: 'void',
};
