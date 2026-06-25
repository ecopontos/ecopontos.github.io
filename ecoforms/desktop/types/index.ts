import type { Interessado as _Interessado } from 'ecoforms-core';

/** Status possíveis de um pacote na suite (contrato v2) */
export type SuiteStatus =
    | 'draft'
    | 'current'
    | 'approved'
    | 'rejected'
    | 'edit'
    | 'locked'
    | 'dispatched'
    | 'pending_review'
    | 'refuted'
    | 'superseded'
    | 'closed'

/** @deprecated Mantido para compatibilidade durante migração. */
export interface TblSuiteRecord {
    id: string
    criado_em: string
    atualizado_em: string
    user_id: string | null
    tipo_form: string
    ativo: boolean
    dados: Record<string, unknown>
    status?: string
    revisor_id?: string
    revisado_em?: string
    motivo_rejeicao?: string
    notas_revisao?: string
    processado_em?: string
    arquivado_em?: string
    prazo_correcao?: string
    usuario_nome_completo?: string
    sync_status?: string | null
}

export interface FormRegistry {
    form_id: string
    titulo: string
    versao: number
    conteudo: FormContent
    criado_em: string
    atualizado_em: string
    auto_aprovacao?: boolean
    ad_hoc?: boolean
    ativo: boolean | number // Can be boolean or 0/1 from SQLite
    slug?: string
    autor?: string
    data_id?: string
}

export interface FormContent {
    id: string
    titulo: string
    campos: FormField[]
    layout?: {
        columns: 1 | 2 | 3 | 4 // Number of columns in grid layout
        gap?: 'sm' | 'md' | 'lg' // Gap between fields (default: md)
    }
}

/**
 * Operadores suportados para regras de visibilidade/condicionalidade
 */
export type VisibilityOperator =
    | 'eq'      // igual a
    | 'neq'     // diferente de
    | 'gt'      // maior que
    | 'gte'     // maior ou igual
    | 'lt'      // menor que
    | 'lte'     // menor ou igual
    | 'contains'    // contém (string)
    | 'startsWith'  // começa com
    | 'endsWith'    // termina com
    | 'in'          // está em (array)
    | 'notIn'       // não está em (array)
    | 'empty'       // está vazio
    | 'notEmpty'    // não está vazio

export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]

export interface JsonObject {
    [key: string]: JsonValue | undefined
}

export interface FormFieldOption {
    label: string
    value: string
    [key: string]: unknown
}

/**
 * Regra de visibilidade/habilitação condicional para campos
 */
export interface VisibilityRule {
    /** Campo de referência para a condição */
    fieldId: string

    /** Operador de comparação */
    operator: VisibilityOperator

    /** Valor esperado para a condição (não usado para empty/notEmpty) */
    value?: JsonValue

    /** Valores esperados (para operadores in/notIn) */
    values?: JsonValue[]

    /** Se true, inverte a lógica (NOT) */
    negate?: boolean

    /** Modo de combinação entre múltiplas regras */
    logic?: 'AND' | 'OR'
}

/**
 * Regra para variante condicional de tipo de campo
 */
export interface TypeVariantRule {
    /** Condições para aplicar esta variante */
    conditions: VisibilityRule[]

    /** Tipo alternativo quando condições são atendidas */
    type: string

    /** Configurações adicionais específicas do tipo */
    config?: Record<string, unknown>
}

export interface FormField {
    id: string
    type: string
    label: string
    required?: boolean
    options?: Array<string | FormFieldOption>
    items?: JsonValue[]
    categorias?: JsonValue[]  // For vistoria_checklist field type
    rawData?: JsonValue[]
    dataSource?: unknown
    source?: string // Legacy alias for dataSource
    sourceMode?: 'manual' | 'seed-on-init'
    autoCurrent?: boolean
    defaultToNow?: boolean
    participants?: JsonValue[]
    description?: string
    helpText?: string
    placeholder?: string
    columnSpan?: 1 | 2 | 3 | 4 // How many columns this field should span
    columnBreak?: boolean // Force line break after this field
    multiple?: boolean // For chips and select fields - allows multiple selection
    dependency?: {
        fieldId: string;        // The ID of the parent field (e.g., 'bairro')
        filterProperty?: string; // Property in the child options to match against parent value (e.g., 'bairro_id')
    }
    value?: string
    defaultValue?: string
    valor_padrao?: JsonValue

    /**
     * Regras de visibilidade condicional do campo
     * Campo só é exibido quando todas as regras são atendidas
     */
    visibility?: VisibilityRule[]

    /**
     * Regras de habilitação condicional (read-only dinâmico)
     * Campo é desabilitado quando as regras NÃO são atendidas
     */
    enabled?: VisibilityRule[]

    /**
     * Variantes de tipo condicional
     * Permite alterar o tipo do campo dinamicamente baseado em condições
     */
    typeVariants?: TypeVariantRule[]

    /**
     * Campos aninhados para grupos (group/repeatable_group)
     * Define os subcampos que compõem um grupo de campos
     */
    campos?: FormField[]

    /**
     * Configuração específica para grupos repetíveis
     */
    config?: {
        repeatable?: boolean
        minItems?: number
        maxItems?: number
        addButtonLabel?: string
        removeButtonLabel?: string
        itemLabel?: string
        layout?: {
            colSpan?: number
        }
        /**
         * When set, form submission data is written back to registro_dados.
         * - tipo: target registry type
         * - mappings: optional fieldId → targetKey mappings
         * - keyField: optional fieldId whose value becomes the registry entry chave
         */
        registryWriteback?: {
            tipo: string
            mappings?: Array<{ fieldId: string; targetKey: string }>
            keyField?: string
        }
        [key: string]: unknown
    }
}

export interface User {
    id: string;
    username: string;
    nome: string;
    perfil: 'gerente' | 'coordenador' | 'campo' | 'admin' | 'operador' | 'encarregado';
    ativo: boolean;
    created_at: string;
    password_hash?: string;
    password?: string;
    setores?: string[];
    org_id?: string;
    escala_id?: string | null;
}

// Interessados Types — fonte canônica em ecoforms-core/repositories
export type { Interessado } from 'ecoforms-core';
type Interessado = _Interessado;

// Kanban Types

export type ProjetoStatus = 'ativo' | 'pausado' | 'concluido' | 'cancelado';

export interface KanbanProject {
    id: string;
    nome: string;
    descricao?: string;
    cor: string;
    status?: ProjetoStatus;
    data_inicio?: string | null;
    data_fim?: string | null;
    responsavel_id?: string | null;
    responsavel_nome?: string | null;
    criado_por: string;
    criado_por_nome?: string;
    arquivado: boolean;
    arquivado_em?: string | null;
    arquivado_por?: string | null;
    created_at: string;
    updated_at: string;
    interessados?: Interessado[];
    meu_nivel_acesso?: 'dono' | 'leitura' | 'edicao';
}

export interface TaskDateConfig {
    tipo: 'unico' | 'periodo' | 'recorrente';
    data_inicio?: string;
    data_fim?: string;
    recorrencia?: {
        frequencia: 'diaria' | 'semanal' | 'mensal' | 'anual';
        intervalo: number;
        dias_semana?: number[];
        fim_recorrencia?: string;
    };
}

export interface KanbanTask {
    id: string;
    projeto_id?: string | null;  // Optional for tasks without project
    parent_task_id?: string | null;
    container_task_id?: string | null;
    cycle_id?: string | null;
    depends_on_task_id?: string | null;
    snap_version?: string | null;
    snap_hash?: string | null;
    snap_frozen_at?: string | null;
    titulo: string;
    descricao?: string;
    status: 'a_fazer' | 'em_progresso' | 'concluido' | 'solicitacao' | 'cancelado';
    prioridade: 'baixa' | 'media' | 'alta';
    atribuido_para?: string;
    criado_por: string;
    prazo?: string;
    prazo_fim?: string;
    tipo_prazo?: 'unico' | 'periodo' | 'recorrente';
    recorrencia?: string; // JSON serialized RecorrenciaConfig
    ordem: number;

    // Integration
    form_registry_id?: string;
    suite_id?: number | string;
    origem_tipo?: string | null;
    origem_id?: string | null;

    // Extended fields (from activities merge)
    payload?: Record<string, unknown> & { dateConfig?: TaskDateConfig };
    location?: string;

    demanda_id?: string | null;
    setor_id?: string | null;

    tags?: string[];
    arquivado: boolean;
    created_at: string;
    updated_at: string;
    interessados?: Interessado[];
    meu_nivel_acesso?: 'dono' | 'leitura' | 'edicao';
}

export interface UnifiedTaskView extends KanbanTask {
    projeto_nome: string;
    projeto_cor: string;
    atribuido_username?: string;
    criador_username?: string;
    form_nome?: string;
    form_status?: string;
    form_dados?: Record<string, unknown>;
    atrasado: boolean;
    proximo_prazo: boolean;
    num_comentarios: number;
    num_anexos: number;
    num_registros: number;
    origem: 'formulario' | 'kanban';
    demanda_status?: string | null;
    demanda_destinatario_id?: string | null;
    demanda_setor_nome?: string | null;
}

// Task History / Events

export type TaskHistoryEventTipo =
    | 'criacao'
    | 'edicao'
    | 'status'
    | 'atribuicao'
    | 'comentario'
    | 'anexo'
    | 'formulario'
    | 'patch'
    | 'arquivamento';

export interface TaskHistoryEvent {
    id: string;
    tarefa_id: string;
    tipo: TaskHistoryEventTipo;
    descricao: string | null;
    usuario_id: string | null;
    usuario_nome: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
}
