import type { Agendamento } from './Agendamento';

export interface AgendamentoFiltros {
    slotId?: string;
    clienteId?: string;
    status?: string;
    serviceTypeId?: string;
    setorId?: string;
}

export interface AgendamentoRepository {
    findById(id: string): Promise<Agendamento | null>;
    findBySlotId(slotId: string): Promise<Agendamento[]>;
    findByClienteId(clienteId: string): Promise<Agendamento[]>;
    findAll(filtros?: AgendamentoFiltros): Promise<Agendamento[]>;
    existeParaClienteESlot(clienteId: string, slotId: string): Promise<boolean>;
    save(agendamento: Agendamento): Promise<void>;
    confirmIfPendente(id: string, atualizadoEm: string): Promise<boolean>;
}
