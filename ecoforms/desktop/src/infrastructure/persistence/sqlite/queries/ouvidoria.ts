/**
 * Catálogo de queries: Ouvidoria (prazos, notificações)
 *
 * Lookups e mutações para o job de verificação de prazos vencidos
 * (VerificarPrazosVencidosJob) e seeds de catalog (já coberto em
 * manifestacoes.ts TIPO_MANIFESTACAO_UPSERT).
 */
import type { QueryDef } from './_types';

export const PRAZOS_VENCIDOS_PENDENTES: QueryDef = {
  sql: `SELECT p.id, p.manifestacao_id, p.tipo_prazo, p.data_limite
 FROM prazos p
 JOIN manifestacoes m ON p.manifestacao_id = m.id
 WHERE p.status = 'pendente'
   AND datetime(p.data_limite) < datetime('now')
   AND p.cobranca_enviada = 0
   AND m.status NOT IN ({{TERMINAIS_CLAUSE}})`,
  description:
    'Prazos vencidos pendentes de cobrança. {{TERMINAIS_CLAUSE}} é substituído por ' +
    'uma lista de placeholders (?,?,...) e os valores vão em params. ' +
    'VerificarPrazosVencidosJob usa terminais = [encerrada, cancelada, encaminhada_sema].',
  params: ['terminais[]'],
  use: 'operacional',
  returns: '{ id, manifestacao_id, tipo_prazo, data_limite }[]',
};

export const USUARIOS_POR_MANIFESTACAO_SETOR: QueryDef = {
  sql: `SELECT u.id
 FROM usuarios u
 JOIN manifestacoes m ON u.setor_id = m.setor_id
 WHERE m.id = ? AND u.ativo = 1`,
  description: 'Usuários ativos do setor de uma manifestação (para notificar)',
  params: ['manifestacao_id'],
  use: 'operacional',
  returns: '{ id }[]',
};

export const NOTIFICACAO_INSERT: QueryDef = {
  sql: `INSERT INTO notificacoes
 (id, usuario_id, manifestacao_id, mensagem, lida, criado_em, prazo_id)
 VALUES (?, ?, ?, ?, 0, ?, ?)`,
  description: 'Insere uma notificação de prazo vencido para um usuário',
  params: ['id', 'usuario_id', 'manifestacao_id', 'mensagem', 'criado_em', 'prazo_id'],
  use: 'operacional',
  returns: 'void',
};

export const PRAZO_MARCAR_COBRANCA_ENVIADA: QueryDef = {
  sql: `UPDATE prazos SET cobranca_enviada = 1, data_cobranca = ? WHERE id = ?`,
  description: 'Marca um prazo como tendo recebido a cobrança',
  params: ['data_cobranca', 'id'],
  use: 'operacional',
  returns: 'void',
};
