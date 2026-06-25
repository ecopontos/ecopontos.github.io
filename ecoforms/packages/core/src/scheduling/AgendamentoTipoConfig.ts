/**
 * Per-type field requirements for agendamento validation.
 * Keeping this as data (not code) makes it easy to drive UI field visibility
 * and server-side validation from the same source of truth.
 */

export type TipoAgendamento = 'museu' | 'volumosos' | 'evento' | string;

export interface AgendamentoTipoConfig {
    /** Human-readable label */
    label: string;
    /** Whether the type checks slot capacity/vagas */
    usesCapacidade: boolean;
    /** Required form fields for this type */
    requiredFields: string[];
    /** Whether to restrict to slot.bairros */
    usesBairroFilter: boolean;
    /** Whether the type requires residue photos */
    requiresFotos: boolean;
    /** Accepted residue types (empty = no restriction) */
    tiposResiduoAceitos: string[];
}

const CONFIGS: Record<string, AgendamentoTipoConfig> = {
    museu: {
        label: 'Museu',
        usesCapacidade: true,
        requiredFields: ['vagasSolicitadas'],
        usesBairroFilter: false,
        requiresFotos: false,
        tiposResiduoAceitos: [],
    },
    volumosos: {
        label: 'Coleta de Volumosos',
        usesCapacidade: false,
        requiredFields: ['tiposResiduo', 'fotosCount', 'bairro'],
        usesBairroFilter: true,
        requiresFotos: true,
        tiposResiduoAceitos: ['moveis', 'eletrodomesticos', 'construcao', 'latas', 'pneus', 'madeiras'],
    },
    evento: {
        label: 'Evento',
        usesCapacidade: true,
        requiredFields: ['vagasSolicitadas'],
        usesBairroFilter: false,
        requiresFotos: false,
        tiposResiduoAceitos: [],
    },
};

export function getAgendamentoTipoConfig(tipo: TipoAgendamento): AgendamentoTipoConfig | undefined {
    return CONFIGS[tipo];
}

export function listAgendamentoTipos(): Array<{ tipo: TipoAgendamento; config: AgendamentoTipoConfig }> {
    return Object.entries(CONFIGS).map(([tipo, config]) => ({ tipo, config }));
}
