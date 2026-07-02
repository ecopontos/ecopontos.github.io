/**
 * Types for unified Client domain (Onda 2 — SDD)
 * Replaces legacy pjuridicas + pfisicas + contatos
 */

const CATEGORIAS_PJ = [
  'Condomínio Residencial',
  'Condomínio Comercial',
  'Escola',
  'Hospital',
  'Hospedagem',
  'Comercial Individual',
  'Outro Tipo de PJ',
] as const;

const CATEGORIAS_PF = [
  'Morador',
  'Síndico',
  'Subsíndico',
  'Zelador',
  'Administrador',
  'Gerente',
  'Proprietário',
  'Pessoa Física',
  'Outro',
] as const;

const CATEGORIAS_CLIENTE = [...CATEGORIAS_PJ, ...CATEGORIAS_PF] as const;

export type CategoriaPJ = typeof CATEGORIAS_PJ[number];

export type CategoriaCliente = typeof CATEGORIAS_CLIENTE[number];

export function categoriasPorTipo(tipo: 'PF' | 'PJ'): readonly string[] {
  return tipo === 'PF' ? CATEGORIAS_PF : CATEGORIAS_PJ;
}

export interface Cliente {
  id: string;
  tipo: 'PF' | 'PJ';
  categoria?: CategoriaCliente | null; // Escola, Condomínio, Hospital, etc.
  nome: string;
  documento?: string | null; // CPF ou CNPJ
  email?: string | null;
  telefone?: string | null;
  cep?: string | null;
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  complemento?: string | null;
  observacoes?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Proveniência da coordenada (Fase 1 — georreferenciamento). Ver desktop/src/lib/geocoding.ts para os tipos GeoProvider/GeoPrecision. */
  geocode_provider?: string | null;
  geocode_source_query?: string | null;
  geocode_display_name?: string | null;
  geocode_precision?: string | null;
  geocode_at?: string | null;
  geocode_confidence?: string | null;
  geocode_validated_at?: string | null;
  geocode_validated_by?: string | null;
  territorial?: string | null; // ID do imóvel cadastrado na prefeitura
  pj_id?: string | null; // ID da PJ a qual esta PF está vinculada como contato
  ativo: number; // SQLite INTEGER 0|1
  criado_em?: string | null;
  atualizado_em?: string | null;
}

export interface ClienteContato {
  id: string;
  cliente_id: string;
  nome?: string | null;
  cargo?: string | null;
  telefone?: string | null;
  email?: string | null;
  principal: number; // SQLite INTEGER 0|1
  ativo: number; // SQLite INTEGER 0|1
  criado_em?: string | null;
}


export interface ClientePjVinculo {
  id: string;
  pf_id: string;
  pj_id: string;
  funcao?: string | null;
  principal: number;
  criado_em?: string | null;
}

export const FUNCOES_VINCULO = [
  'Síndico',
  'Subsíndico',
  'Zelador',
  'Administrador',
  'Gerente',
  'Proprietário',
  'Morador',
  'Outro',
] as const;

export type FuncaoVinculo = typeof FUNCOES_VINCULO[number];

export interface ClienteFilter {
  tipo?: 'PF' | 'PJ';
  ativo?: boolean;
  searchTerm?: string;
}

// ── Fase 3 — georreferenciamento: vínculo cliente↔imóvel (terreno) ──

export const TIPOS_RELACAO_VINCULO = [
  'proprietario',
  'ocupante',
  'responsavel',
  'sindico',
  'gestor',
  'contribuinte',
  'ponto_coleta',
  'contato',
] as const;

export type TipoRelacaoVinculo = typeof TIPOS_RELACAO_VINCULO[number];

export const ORIGENS_VINCULO = [
  'manual',
  'importacao',
  'codigo_cadastral',
  'geocode_inside_polygon',
  'gps_inside_polygon',
  'fiscalizacao',
  'sync',
] as const;

export type OrigemVinculo = typeof ORIGENS_VINCULO[number];

export type ConfiancaVinculo = 'alta' | 'media' | 'baixa';

export interface ClienteImovelVinculo {
  id: string;
  cliente_id: string;
  imovel_id: string; // FK para terrenos.id
  tipo_relacao?: TipoRelacaoVinculo | null;
  principal: number; // SQLite INTEGER 0|1
  confianca?: ConfiancaVinculo | null;
  origem?: OrigemVinculo | null;
  valido_de?: string | null;
  valido_ate?: string | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
}

/** Vínculo enriquecido com dados do imóvel para exibição na UI. */
export interface ClienteImovelVinculoWithDetails extends ClienteImovelVinculo {
  imovel_nome: string;
  imovel_codigo_cadastral?: string | null;
  imovel_bairro?: string | null;
  imovel_cidade?: string | null;
  imovel_estado?: string | null;
}

/** Sugestão de vínculo gerada por heurística (código cadastral / PIP / proximidade). */
export interface VinculoSuggestion {
  imovel_id: string;
  imovel_nome: string;
  imovel_codigo_cadastral?: string | null;
  imovel_bairro?: string | null;
  motivo: 'codigo_cadastral' | 'ponto_no_poligono' | 'proximidade';
  distancia_m?: number | null;
  confianca: ConfiancaVinculo;
}

/** Imóvel (terreno) disponível para vinculação, com campos mínimos para o picker. */
export interface ImovelDisponivel {
  id: string;
  nome: string;
  codigo_cadastral?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

// ── Fase 4 — georreferenciamento: pontos operacionais ──

export const PONTO_OPERACIONAL_TIPOS = [
  'entrada',
  'portaria',
  'coleta',
  'referencia',
  'acesso_servico',
  'vistoria',
] as const;

export type PontoOperacionalTipo = typeof PONTO_OPERACIONAL_TIPOS[number];

export const ORIGENS_PONTO = [
  'manual',
  'gps',
  'centroide',
  'importacao',
] as const;

export type OrigemPonto = typeof ORIGENS_PONTO[number];

export interface PontoOperacional {
  id: string;
  imovel_id: string; // FK para terrenos.id
  tipo?: PontoOperacionalTipo | null;
  latitude: number;
  longitude: number;
  principal: number; // SQLite INTEGER 0|1
  origem?: OrigemPonto | null;
  observacao?: string | null;
  criado_em?: string | null;
  atualizado_em?: string | null;
}
