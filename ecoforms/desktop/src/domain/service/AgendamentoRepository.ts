import type { Agendamento } from './Agendamento';

export interface AgendamentoFiltros {
    slotId?: string;
    clienteId?: string;
    status?: string;
    serviceTypeId?: string;
    setorId?: string;
}

export interface AgendamentoWithDetails {
    cliente_nome: string | null;
    cliente_email: string | null;
    cliente_telefone: string | null;
    bairro: string | null;
    vagas_solicitadas: number;
    status: string;
    dados_formulario: string | null;
    slot_titulo: string | null;
    local: string | null;
    data_inicio: string | null;
    data_fim: string | null;
    service_type_nome: string | null;
}

export interface AgendamentoRepository {
    findById(id: string): Promise<Agendamento | null>;
    findByIdWithDetails(id: string): Promise<AgendamentoWithDetails | null>;
    findBySlotId(slotId: string): Promise<Agendamento[]>;
    findByClienteId(clienteId: string): Promise<Agendamento[]>;
    findAll(filtros?: AgendamentoFiltros): Promise<Agendamento[]>;
    existeParaClienteESlot(clienteId: string, slotId: string): Promise<boolean>;
    save(agendamento: Agendamento): Promise<void>;
    confirmIfPendente(id: string, atualizadoEm: string): Promise<boolean>;
}
