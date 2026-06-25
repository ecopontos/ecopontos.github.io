import type { Agendamento } from './Agendamento';

export interface AgendamentoFiltros {
    slotId?: string;
    clienteId?: string;
    status?: string;
    serviceTypeId?: string;
    setorId?: string;
    limit?: number;
    offset?: number;
}

export interface AgendamentoWithDetails {
    clienteNome: string | null;
    clienteEmail: string | null;
    clienteTelefone: string | null;
    bairro: string | null;
    vagasSolicitadas: number;
    status: string;
    dadosFormulario: string | null;
    slotTitulo: string | null;
    local: string | null;
    dataInicio: string | null;
    dataFim: string | null;
    serviceTypeNome: string | null;
}

export interface AgendamentoMapPoint {
    id: string;
    clienteId: string;
    clienteNome: string;
    bairro: string | null;
    endereco: string | null;
    numero: string | null;
    cidade: string | null;
    latitude: number;
    longitude: number;
    status: string;
    vagasSolicitadas: number;
}

export interface AgendamentoRepository {
    findById(id: string): Promise<Agendamento | null>;
    findByIdWithDetails(id: string): Promise<AgendamentoWithDetails | null>;
    findBySlotId(slotId: string): Promise<Agendamento[]>;
    findByClienteId(clienteId: string): Promise<Agendamento[]>;
    findAll(filtros?: AgendamentoFiltros): Promise<Agendamento[]>;
    findMapDataBySlotId(slotId: string): Promise<AgendamentoMapPoint[]>;
    existeParaClienteESlot(clienteId: string, slotId: string): Promise<boolean>;
    save(agendamento: Agendamento): Promise<void>;
    confirmIfPendente(id: string, atualizadoEm: string): Promise<boolean>;
}
