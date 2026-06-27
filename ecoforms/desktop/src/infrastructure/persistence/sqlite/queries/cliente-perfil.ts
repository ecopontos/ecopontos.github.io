/**
 * Catálogo de queries: Perfil do Cliente (painel de atividade agregada)
 *
 * Agregações e listagens por `cliente_id` para o painel de perfil em
 * `app/clientes/[id]` — KPIs, coletas, ocorrências, intercorrências,
 * manifestações e roteiros. Ver docs/PLANO_PERFIL_CLIENTE.md.
 */
import type { QueryDef } from './_types';

export interface ClientePerfilKpisRow {
  primeira_coleta: string | null;
  ultima_coleta: string | null;
  total_coletas: number;
  total_quantidade: number;
  manifestacoes_abertas: number;
  roteiros_ativos: number;
}

export interface ClienteColetaRow {
  id: string;
  registrado_em: string;
  horario_visita: string | null;
  coleta_realizada: number;
  quantidade: number | null;
  ocorrencia: string | null;
  roteiro_nome: string;
  roteiro_codigo: string | null;
}

export interface ClienteOcorrenciaRow {
  id: string;
  registrado_em: string;
  horario_visita: string | null;
  ocorrencia: string;
}

export interface ClienteIntercorrenciaRow {
  id: string;
  registrado_em: string;
  descricao: string | null;
  quantidade: number | null;
  resolvido: number;
  tipo_nome: string;
  tipo_cor: string;
}

export interface ClienteManifestacaoRow {
  id: string;
  protocolo: string;
  assunto: string;
  status: string;
  criado_em: string;
  prazo_limite: string | null;
  tipo_nome: string | null;
}

export interface ClienteRoteiroRow {
  ordem: number;
  ativo: number;
  roteiro_id: string;
  codigo: string | null;
  nome: string;
  turno: string | null;
  dia_semana: string | null;
  periodicidade: string | null;
  situacao: string;
}

export const CLIENTE_PERFIL_KPIS: QueryDef = {
  sql: `SELECT
      (SELECT MIN(registrado_em) FROM execucao_clientes WHERE cliente_id = ?) AS primeira_coleta,
      (SELECT MAX(registrado_em) FROM execucao_clientes WHERE cliente_id = ?) AS ultima_coleta,
      (SELECT COUNT(*) FROM execucao_clientes WHERE cliente_id = ? AND coleta_realizada = 1) AS total_coletas,
      (SELECT COALESCE(SUM(quantidade), 0) FROM execucao_clientes WHERE cliente_id = ? AND coleta_realizada = 1) AS total_quantidade,
      (SELECT COUNT(*) FROM manifestacoes WHERE cliente_id = ? AND status NOT IN ('respondida','encerrada')) AS manifestacoes_abertas,
      (SELECT COUNT(*) FROM roteiro_clientes WHERE cliente_id = ? AND ativo = 1) AS roteiros_ativos`,
  description: 'KPIs agregados do perfil de um cliente (1ª/última coleta, totais, manifestações abertas, roteiros ativos) — useClientePerfilKpis',
  params: ['cliente_id', 'cliente_id', 'cliente_id', 'cliente_id', 'cliente_id', 'cliente_id'],
  use: 'medida',
  returns: 'ClientePerfilKpisRow',
};

export const CLIENTE_COLETAS: QueryDef = {
  sql: `SELECT ec.id, ec.registrado_em, ec.horario_visita, ec.coleta_realizada, ec.quantidade, ec.ocorrencia,
              r.nome AS roteiro_nome, r.codigo AS roteiro_codigo
       FROM execucao_clientes ec
       JOIN execucao_coleta exc ON exc.id = ec.execucao_id
       JOIN roteiros r ON r.id = exc.roteiro_id
       WHERE ec.cliente_id = ?
       ORDER BY ec.registrado_em DESC`,
  description: 'Histórico de coletas de um cliente, com roteiro — useClienteColetas',
  params: ['cliente_id'],
  use: 'operacional',
  returns: 'ClienteColetaRow[]',
};

export const CLIENTE_OCORRENCIAS_COLETA: QueryDef = {
  sql: `SELECT ec.id, ec.registrado_em, ec.horario_visita, ec.ocorrencia
       FROM execucao_clientes ec
       WHERE ec.cliente_id = ? AND ec.ocorrencia IS NOT NULL AND ec.ocorrencia <> ''
       ORDER BY ec.registrado_em DESC`,
  description: 'Ocorrências de coleta (texto livre por execução) de um cliente — useClienteOcorrencias',
  params: ['cliente_id'],
  use: 'operacional',
  returns: 'ClienteOcorrenciaRow[]',
};

export const CLIENTE_INTERCORRENCIAS: QueryDef = {
  sql: `SELECT DISTINCT ic.id, ic.registrado_em, ic.descricao, ic.quantidade, ic.resolvido,
              ti.nome AS tipo_nome, COALESCE(ti.cor, '#6B7280') AS tipo_cor
       FROM intercorrencias_coleta ic
       JOIN execucao_clientes ec ON ec.execucao_id = ic.execucao_id
       JOIN tipos_intercorrencia ti ON ti.id = ic.tipo_ocorrencia_id
       WHERE ec.cliente_id = ?
       ORDER BY ic.registrado_em DESC`,
  description: 'Intercorrências das execuções que atenderam um cliente — nível execução, não por-cliente — useClienteIntercorrencias',
  params: ['cliente_id'],
  use: 'operacional',
  returns: 'ClienteIntercorrenciaRow[]',
};

export const CLIENTE_MANIFESTACOES: QueryDef = {
  sql: `SELECT m.id, m.protocolo, m.assunto, m.status, m.criado_em, m.prazo_limite,
              tm.nome AS tipo_nome
       FROM manifestacoes m
       LEFT JOIN tipos_manifestacao tm ON tm.id = m.tipo_id
       WHERE m.cliente_id = ?
       ORDER BY m.criado_em DESC`,
  description: 'Manifestações de um cliente, com tipo — useClienteManifestacoes',
  params: ['cliente_id'],
  use: 'operacional',
  returns: 'ClienteManifestacaoRow[]',
};

export const CLIENTE_ROTEIROS: QueryDef = {
  sql: `SELECT rc.ordem, rc.ativo, r.id AS roteiro_id, r.codigo, r.nome, r.turno, r.dia_semana, r.periodicidade, r.situacao
       FROM roteiro_clientes rc
       JOIN roteiros r ON r.id = rc.roteiro_id
       WHERE rc.cliente_id = ?
       ORDER BY r.nome`,
  description: 'Roteiros aos quais um cliente está vinculado — useClienteRoteiros',
  params: ['cliente_id'],
  use: 'operacional',
  returns: 'ClienteRoteiroRow[]',
};
