import type { ServiceSlot } from './ServiceSlot';

export interface ServiceSlotRepository {
    findById(id: string): Promise<ServiceSlot | null>;
    findAll(filtros?: { status?: string; serviceTypeId?: string; dataInicio?: string; dataFim?: string }): Promise<ServiceSlot[]>;
    save(slot: ServiceSlot): Promise<void>;
    updateVagasOcupadas(id: string, vagas: number): Promise<void>;
    transaction<T>(fn: (tx: ServiceSlotRepository) => Promise<T>): Promise<T>;
}
