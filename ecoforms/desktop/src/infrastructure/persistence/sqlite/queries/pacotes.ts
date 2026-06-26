import type { QueryDef } from './_types';

export const PACOTE_ATUAL: QueryDef = {
  sql: `SELECT tipo_modulo, tipo_recurso, id_proprietario, id_entidade, tipo_entidade, carga_json
 FROM pacotes WHERE id_pacote = ? AND atual = 1 LIMIT 1`,
  description: 'Dados do pacote atual por ID',
  params: ['id_pacote'],
  use: 'operacional',
  returns: '{ tipo_modulo, tipo_recurso, id_proprietario, id_entidade, tipo_entidade, carga_json }',
};

export const PACOTES_HISTORICO: QueryDef = {
  sql: `SELECT
    id_pacote AS id,
    tipo_modulo AS tipo_form,
    carga_json AS dados,
    id_proprietario AS user_id,
    status,
    criado_em,
    fechado_em AS arquivado_em
 FROM pacotes
 WHERE status IN ('closed', 'superseded')
   AND atual = 0
 ORDER BY fechado_em DESC`,
  description: 'Histórico de pacotes fechados ou substituídos',
  params: [],
  use: 'operacional',
  returns: '{ id, tipo_form, dados, user_id, status, criado_em, arquivado_em }[]',
};

export const PACOTE_RESTORE: QueryDef = {
  sql: `UPDATE pacotes SET status = 'current', atual = 1, fechado_em = NULL WHERE id_pacote = ?`,
  description: 'Restaura um pacote para status current',
  params: ['id_pacote'],
  use: 'operacional',
  returns: 'void',
};

export const PACOTE_CLOSE: QueryDef = {
  sql: `UPDATE pacotes SET status = 'closed', atual = 0 WHERE id_pacote = ?`,
  description: 'Fecha um pacote',
  params: ['id_pacote'],
  use: 'operacional',
  returns: 'void',
};

export const PACOTE_INACTIVATE_ATUAL: QueryDef = {
  sql: `UPDATE pacotes SET atual = 0 WHERE id_pacote = ? AND atual = 1`,
  description: 'Invalida a versao atual de um pacote (devolver.action - step 1)',
  params: ['id_pacote'],
  use: 'operacional',
  returns: 'void',
};

export const PACOTE_NEW_VERSION_FROM_LAST: QueryDef = {
  sql: `INSERT INTO pacotes (
  id_pacote, num_versao, tipo_modulo, tipo_recurso, status,
  id_proprietario, atual, id_entidade, tipo_entidade,
  carga_json, criado_em, fechado_em
)
 SELECT id_pacote,
        (SELECT COALESCE(MAX(num_versao), 0) + 1 FROM pacotes WHERE id_pacote = ?),
        tipo_modulo, tipo_recurso, 'refuted',
        id_proprietario, 1, id_entidade, tipo_entidade,
        carga_json, ?, NULL
 FROM pacotes WHERE id_pacote = ? AND atual = 0
 ORDER BY num_versao DESC LIMIT 1`,
  description: 'Cria nova versao de um pacote com status refuted, copiando da ultima versao inativa (devolver.action - step 2)',
  params: ['id_pacote_a', 'criado_em', 'id_pacote_b'],
  use: 'operacional',
  returns: 'void',
};

export const PACOTE_NEW_VERSION_DISPATCHED: QueryDef = {
  sql: `INSERT INTO pacotes (
  id_pacote, num_versao, tipo_modulo, tipo_recurso, status,
  id_proprietario, atual, ref_id_pacote, id_entidade, tipo_entidade,
  carga_json, criado_em, fechado_em
)
 SELECT
   ?, 1, tipo_modulo, tipo_recurso, 'dispatched',
   ?, 1, ?, id_entidade, tipo_entidade,
   carga_json, ?, NULL
 FROM pacotes WHERE id_pacote = ? AND atual = 0
 ORDER BY num_versao DESC LIMIT 1`,
  description: 'Cria nova versao de um pacote com status dispatched (reencaminhar.action - step 2)',
  params: ['novo_id_pacote', 'novo_id_proprietario', 'ref_id_pacote', 'criado_em', 'id_pacote_origem'],
  use: 'operacional',
  returns: 'void',
};

export const PACOTE_SOLICITAR_INSERT: QueryDef = {
  sql: `INSERT INTO pacotes (
  id_pacote, num_versao, tipo_modulo, tipo_recurso, status,
  id_proprietario, atual, ref_id_pacote, id_entidade, tipo_entidade,
  carga_json, criado_em, fechado_em
) VALUES (?, 1, ?, ?, 'current', ?, 1, ?, ?, ?, ?, ?, NULL)`,
  description: 'Insere um novo pacote a partir de outro (solicitar.action - cria "filho" referenciando origem)',
  params: [
    'id_pacote', 'tipo_modulo', 'tipo_recurso',
    'id_proprietario', 'ref_id_pacote', 'id_entidade', 'tipo_entidade',
    'carga_json', 'criado_em',
  ],
  use: 'operacional',
  returns: 'void',
};

export const PACOTE_BY_ID_ATUAL: QueryDef = {
  sql: `SELECT tipo_modulo, tipo_recurso, id_proprietario, id_entidade, tipo_entidade, carga_json
 FROM pacotes WHERE id_pacote = ? AND atual = 1 LIMIT 1`,
  description: 'Dados do pacote atual (atual=1) por id (solicitar.action - read origem)',
  params: ['id_pacote'],
  use: 'operacional',
  returns: '{ tipo_modulo, tipo_recurso, id_proprietario, id_entidade, tipo_entidade, carga_json }',
};

export const PACOTES_RECENT_ATUAL: QueryDef = {
  sql: `SELECT id_pacote, tipo_modulo, carga_json, criado_em, status, id_proprietario
 FROM pacotes WHERE atual = 1
 ORDER BY criado_em DESC LIMIT 20`,
  description: 'Pacotes ativos (atual=1) mais recentes — feed do TaskDetailPage',
  params: [],
  use: 'operacional',
  returns: '{ id_pacote, tipo_modulo, carga_json, criado_em, status, id_proprietario }[]',
};

export const PACOTE_BY_ID: QueryDef = {
  sql: `SELECT * FROM pacotes WHERE id = ? LIMIT 1`,
  description: 'Pacote completo por id (app/view). NOTA: usa coluna `id` (preserva comportamento original do app/view — investigar se é alias de id_pacote).',
  params: ['id'],
  use: 'operacional',
  returns: 'PacoteRow',
};

export const PACOTE_UPDATE_STATUS: QueryDef = {
  sql: `UPDATE pacotes SET status = ? WHERE id_pacote = ?`,
  description: 'Atualiza o status de um pacote (revisão de submissão no app/view)',
  params: ['status', 'id_pacote'],
  use: 'operacional',
  returns: 'void',
};

export const PACOTE_UPDATE_DADOS: QueryDef = {
  sql: `UPDATE pacotes SET dados = ? WHERE id_pacote = ?`,
  description: 'Atualiza o JSON de dados de um pacote (edição no app/view)',
  params: ['dados', 'id_pacote'],
  use: 'operacional',
  returns: 'void',
};

export const PACOTE_INSERT_FROM_FORM: QueryDef = {
  sql: `INSERT INTO pacotes
 (id_pacote, num_versao, tipo_modulo, tipo_recurso, status,
  id_proprietario, atual, dados, carga_json, criado_em)
 VALUES (?, 1, ?, ?, ?, ?, 1, ?, ?, ?)`,
  description: 'Insere um pacote v2 a partir de um formulário regular (FormRenderer — formulário branch)',
  params: [
    'id_pacote', 'tipo_modulo', 'tipo_recurso', 'status',
    'id_proprietario', 'dados', 'carga_json', 'criado_em',
  ],
  use: 'operacional',
  returns: 'void',
};

export const PACOTES_TIPOS_FORM_DISTINTOS: QueryDef = {
  sql: `SELECT DISTINCT COALESCE(tipo_modulo, tipo_form) AS tipo_form FROM pacotes WHERE atual = 1 OR (atual IS NULL AND ativo = 1) ORDER BY tipo_form`,
  description: 'Lista distinta de tipo_form/tipo_modulo em pacotes ativos (usePacoteFormTypes / useAnalysisData)',
  params: [],
  use: 'operacional',
  returns: '{ tipo_form }[]',
};

export const PACOTES_PENDING_SOLICITACOES_COUNT: QueryDef = {
  sql: `SELECT COUNT(*) AS total FROM pacotes WHERE (
    tipo_recurso = 'solicitacao'
    OR json_extract(carga_json, '$.payload.campos.tipo_submissao') = 'SOLICITACAO'
    OR json_extract(carga_json, '$.payload.tipo_submissao') = 'SOLICITACAO'
    OR json_extract(carga_json, '$.campos.tipo_submissao') = 'SOLICITACAO'
    OR json_extract(carga_json, '$.form_data.tipo_submissao') = 'SOLICITACAO'
    OR json_extract(dados, '$.campos.tipo_submissao') = 'SOLICITACAO'
    OR json_extract(dados, '$.form_data.tipo_submissao') = 'SOLICITACAO'
  )
  AND (status IS NULL OR status IN ('submitted', 'pending', 'pendente', 'under_review'))
  AND (ativo IS NULL OR ativo = 1)
  AND (
    ? IS NULL
    OR COALESCE(
        NULLIF(json_extract(carga_json, '$.setor_id'), ''),
        NULLIF(json_extract(carga_json, '$.campos.setor_id'), ''),
        NULLIF(json_extract(carga_json, '$.form_data.setor_id'), ''),
        NULLIF(json_extract(carga_json, '$.payload.setor_id'), ''),
        NULLIF(json_extract(carga_json, '$.payload.campos.setor_id'), ''),
        NULLIF(json_extract(dados, '$.campos.setor_id'), ''),
        NULLIF(json_extract(dados, '$.form_data.setor_id'), ''),
        NULLIF(json_extract(carga_json, '$.departamento'), ''),
        NULLIF(json_extract(carga_json, '$.campos.departamento'), ''),
        NULLIF(json_extract(carga_json, '$.form_data.departamento'), ''),
        NULLIF(json_extract(carga_json, '$.payload.departamento'), ''),
        NULLIF(json_extract(carga_json, '$.payload.campos.departamento'), ''),
        NULLIF(json_extract(dados, '$.campos.departamento'), ''),
        NULLIF(json_extract(dados, '$.form_data.departamento'), '')
      ) = ?
    OR (
        json_extract(carga_json, '$.setor_id') IS NULL
        AND json_extract(carga_json, '$.campos.setor_id') IS NULL
        AND json_extract(carga_json, '$.form_data.setor_id') IS NULL
        AND json_extract(carga_json, '$.payload.setor_id') IS NULL
        AND json_extract(carga_json, '$.payload.campos.setor_id') IS NULL
        AND json_extract(dados, '$.campos.setor_id') IS NULL
        AND json_extract(dados, '$.form_data.setor_id') IS NULL
        AND json_extract(carga_json, '$.departamento') IS NULL
        AND json_extract(carga_json, '$.campos.departamento') IS NULL
        AND json_extract(carga_json, '$.form_data.departamento') IS NULL
        AND json_extract(carga_json, '$.payload.departamento') IS NULL
        AND json_extract(carga_json, '$.payload.campos.departamento') IS NULL
        AND json_extract(dados, '$.campos.departamento') IS NULL
        AND json_extract(dados, '$.form_data.departamento') IS NULL
      )
  )`,
  description:
    'Contagem de pacotes de solicitação pendentes (badge da sidebar). ' +
    'Filtro opcional de setor via `?` (passado 2x; null = admin, sem filtro; valor = gerente com setor restrito).',
  params: ['setor_id?', 'setor_id?'],
  use: 'medida',
  returns: '{ total }',
};

export const PACOTES_FOR_TAREFA: QueryDef = {
  sql: `
    SELECT
        s.id_pacote,
        s.id_pacote       AS id,
        s.id_proprietario,
        s.id_proprietario AS user_id,
        s.criado_em,
        s.tipo_modulo,
        s.tipo_modulo     AS tipo_form,
        s.status,
        s.carga_json,
        s.carga_json      AS dados,
        u.nome            AS usuario_nome
    FROM pacotes s
    LEFT JOIN usuarios u ON s.id_proprietario = u.id
    WHERE s.id_pacote = (SELECT suite_id FROM tarefas WHERE id = ? LIMIT 1)
       OR s.ref_id_pacote IN (SELECT suite_id FROM tarefas WHERE id = ? LIMIT 1)
    ORDER BY s.criado_em DESC
  `,
  description: 'Pacotes (entradas de suite) vinculados a uma tarefa via suite_id ou ref_id_pacote',
  params: ['tarefa_id_a', 'tarefa_id_b'],
  use: 'operacional',
  returns: '{ id_pacote, id, id_proprietario, user_id, criado_em, tipo_modulo, tipo_form, status, carga_json, dados, usuario_nome }[]',
};
