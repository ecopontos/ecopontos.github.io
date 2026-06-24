import type { QueryDef } from './_types';

export const SOLICITACOES_POR_USUARIO: QueryDef = {
  sql: `
    SELECT
        t.id              AS id_pacote,
        t.id_formulario   AS tipo_recurso,
        t.status,
        t.criado_por      AS id_proprietario,
        t.criado_em,
        t.carga           AS carga_json,
        t.id              AS tarefa_gerada_id,
        t.arquivado       AS tarefa_arquivada,
        t.motivo_rejeicao,
        t.atualizado_em   AS revisado_em
    FROM tarefas t
    WHERE t.criado_por = ?
      AND t.origem = 'solicitacao'
      AND t.deletado_em IS NULL
    ORDER BY t.criado_em DESC
  `,
  description: 'Solicitações (tarefas de origem=solicitacao) criadas por um usuário',
  params: ['usuario_id'],
  use: 'operacional',
  returns: '{ id_pacote, tipo_recurso, status, id_proprietario, criado_em, carga_json, tarefa_gerada_id, tarefa_arquivada, motivo_rejeicao, revisado_em }[]',
};

export const FORMS_AD_HOC_DISPONIVEIS: QueryDef = {
  sql: `
    SELECT DISTINCT rf.form_id, rf.titulo
    FROM registro_formularios rf, json_each(rf.conteudo, '$.campos') f
    WHERE rf.ativo = 1
      AND rf.ad_hoc = 1
      AND json_extract(f.value, '$.type') = 'hidden'
      AND (
          json_extract(f.value, '$.value') = 'SOLICITACAO'
          OR json_extract(f.value, '$.defaultValue') = 'SOLICITACAO'
      )
    ORDER BY rf.titulo
  `,
  description: 'Formulários ad-hoc ativos que contêm campo hidden com value=SOLICITACAO',
  params: [],
  use: 'operacional',
  returns: '{ form_id, titulo }[]',
};
