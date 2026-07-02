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
