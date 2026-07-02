import type { QueryDef } from './_types';

export const AGENDAMENTOS_RESUMO: QueryDef = {
    sql: `SELECT status, COUNT(*) AS total FROM agendamentos GROUP BY status`,
    description: 'Resumo de agendamentos por status',
    params: [],
    use: 'dashboard',
    returns: '{ status: string; total: number }[]',
};

export const AGENDAMENTOS_POR_SLOT: QueryDef = {
    sql: `SELECT a.*, u.nome AS responsavel_nome
          FROM agendamentos a
          LEFT JOIN usuarios u ON u.id = a.responsavel_id
          WHERE a.slot_id = ?
          ORDER BY a.criado_em ASC`,
    description: 'Lista de agendamentos de um slot com responsável',
    params: ['slot_id'],
    use: 'operacional',
    returns: 'AgendamentoComResponsavelRow[]',
};

export const AGENDAMENTOS_POR_CLIENTE: QueryDef = {
    sql: `SELECT a.*, st.nome AS tipo_nome, ss.data_inicio, ss.data_fim
          FROM agendamentos a
          JOIN janelas_agendamento ss ON ss.id = a.slot_id
          JOIN tipos_servico st ON st.id = a.service_type_id
          WHERE a.cliente_id = ?
          ORDER BY ss.data_inicio DESC`,
    description: 'Histórico de agendamentos de um cliente',
    params: ['cliente_id'],
    use: 'operacional',
    returns: 'AgendamentoComTipoESlot[]',
};

export const AGENDAMENTO_BY_ID_WITH_DETAILS: QueryDef = {
    sql: `SELECT ag.cliente_nome, ag.cliente_email, ag.cliente_telefone,
                 ag.bairro, ag.vagas_solicitadas, ag.status, ag.dados_formulario,
                 sl.titulo AS slot_titulo, sl.local, sl.data_inicio, sl.data_fim,
                 st.nome  AS service_type_nome
          FROM agendamentos ag
          JOIN janelas_agendamento  sl ON sl.id = ag.slot_id
          JOIN tipos_servico  st ON st.id = ag.service_type_id
          WHERE ag.id = ?`,
    description: 'Agendamento por id com joins em slot e service type (EditTaskModal)',
    params: ['id'],
    use: 'operacional',
    returns: 'AgendamentoComDetalhes',
};

export const AGENDAMENTOS_BY_USER: QueryDef = {
    sql: `SELECT a.id, a.status, a.cliente_nome, a.vagas_solicitadas, a.criado_em,
                 ss.titulo AS slot_titulo, ss.data_inicio, st.nome AS tipo_nome
          FROM agendamentos a
          JOIN janelas_agendamento ss ON ss.id = a.slot_id
          JOIN tipos_servico st ON st.id = a.service_type_id
          WHERE a.cliente_id = ? OR a.criado_por = ?
          ORDER BY a.criado_em DESC`,
    description: 'Agendamentos criados por ou de um cliente (exportacao GDPR)',
    params: ['user_id_a', 'user_id_b'],
    use: 'operacional',
    returns: '{ id, status, cliente_nome, vagas_solicitadas, criado_em, slot_titulo, data_inicio, tipo_nome }[]',
};

export const AGENDAMENTOS_DELETE_BY_USER: QueryDef = {
    sql: `DELETE FROM agendamentos WHERE cliente_id = ? OR criado_por = ?`,
    description: 'Deleta agendamentos vinculados a um usuario (eliminacao titular)',
    params: ['user_id_a', 'user_id_b'],
    use: 'operacional',
    returns: 'void',
};

export const AGENDAMENTOS_VAGAS_OCUPACAO: QueryDef = {
    sql: `SELECT ss.id, ss.titulo, ss.capacidade, ss.vagas_ocupadas,
                 ROUND(CAST(ss.vagas_ocupadas AS REAL) / ss.capacidade, 2) AS ocupacao_pct
          FROM janelas_agendamento ss
          WHERE ss.status = 'publicado' AND ss.capacidade IS NOT NULL
          ORDER BY ocupacao_pct DESC`,
    description: 'Ocupação percentual dos slots publicados com capacidade',
    params: [],
    use: 'dashboard',
    returns: '{ id: string; titulo: string; capacidade: number; vagas_ocupadas: number; ocupacao_pct: number }[]',
};

export const SLOTS_COM_VAGAS_DISPONIVEIS: QueryDef = {
    sql: `SELECT ss.*, st.nome AS tipo_nome, st.icone, st.cor, st.form_id,
                 st.validator_key, st.abertura_regra,
                 (ss.capacidade - ss.vagas_ocupadas) AS vagas_livres
          FROM janelas_agendamento ss
          JOIN tipos_servico st ON st.id = ss.service_type_id
          WHERE ss.status = 'publicado'
            AND (ss.capacidade IS NULL OR ss.vagas_ocupadas < ss.capacidade)
            AND (ss.abertura_em IS NULL OR ss.abertura_em <= datetime('now'))
            AND date(ss.data_fim) >= date('now')
          ORDER BY ss.data_inicio ASC`,
    description: 'Slots publicados com vagas disponíveis e janela de abertura aberta',
    params: [],
    use: 'operacional',
    returns: 'SlotComTipoRow[]',
};

export const TAREFAS_CAMPO_HOJE: QueryDef = {
    sql: `SELECT t.id, t.titulo, t.status, t.carga, t.agendamento_id,
                 t.atribuido_para, t.prazo
          FROM tarefas t
          WHERE t.origem = 'booking'
            AND t.atribuido_para = ?
            AND date(t.prazo) = date('now')
            AND t.status NOT IN ('concluido', 'cancelado')
          ORDER BY t.prazo ASC`,
    description: 'Tasks de campo do operador para hoje (origem booking)',
    params: ['usuario_id'],
    use: 'operacional',
    returns: 'TarefaCampoRow[]',
};

export const AGENDAMENTOS_NOTIFICACOES: QueryDef = {
  sql: `SELECT * FROM notificacoes_agendamento
          WHERE agendamento_id = ?
          ORDER BY criado_em ASC`,
  description: 'Notificações de um agendamento',
  params: ['agendamento_id'],
  use: 'operacional',
  returns: 'AgendamentoNotificacaoRow[]',
};

export const AGENDAMENTOS_MAP_POINTS_BY_SLOT: QueryDef = {
  sql: `SELECT a.id, a.cliente_id AS clienteId, a.cliente_nome AS clienteNome,
         a.bairro, a.status, a.vagas_solicitadas AS vagasSolicitadas,
         c.endereco, c.numero, c.cidade,
         COALESCE(po.latitude, t.centroid_lat, c.latitude)  AS latitude,
         COALESCE(po.longitude, t.centroid_lng, c.longitude) AS longitude
  FROM agendamentos a
  JOIN clientes c ON c.id = a.cliente_id
  LEFT JOIN terrenos t ON t.id = c.terreno_id
  LEFT JOIN imovel_pontos_operacionais po ON po.imovel_id = c.terreno_id
    AND NOT EXISTS (
      SELECT 1 FROM imovel_pontos_operacionais po2
      WHERE po2.imovel_id = po.imovel_id
        AND (po2.principal > po.principal
             OR (po2.principal = po.principal AND po2.criado_em < po.criado_em)))
  WHERE a.slot_id = ?
    AND a.status != 'cancelado'
    AND (po.latitude IS NOT NULL OR t.centroid_lat IS NOT NULL OR c.latitude IS NOT NULL)
  ORDER BY a.criado_em`,
  description: 'Pontos georreferenciados de agendamentos ativos de um slot (ponto op > terreno centroid > cliente lat/lng)',
  params: ['slot_id'],
  use: 'operacional',
  returns: 'AgendamentoMapPoint[]',
};

export const AGENDAMENTOS_POR_USUARIO_EXPORT: QueryDef = {
  sql: `SELECT a.id, a.status, a.cliente_nome, a.vagas_solicitadas, a.criado_em,
        ss.titulo AS slot_titulo, ss.data_inicio, st.nome AS tipo_nome
 FROM agendamentos a
 JOIN janelas_agendamento ss ON ss.id = a.slot_id
 JOIN tipos_servico st ON st.id = a.service_type_id
 WHERE a.cliente_id = ? OR a.criado_por = ?
 ORDER BY a.criado_em DESC`,
  description: 'Agendamentos de um usuário para exportação GDPR',
  params: ['cliente_id', 'criado_por'],
  use: 'operacional',
  returns: '{ id, status, cliente_nome, vagas_solicitadas, criado_em, slot_titulo, data_inicio, tipo_nome }[]',
};
