import type { ServiceType } from './ServiceType';

export interface ServiceTypeRepository {
    findById(id: string): Promise<ServiceType | null>;
    findAll(ativo?: boolean): Promise<ServiceType[]>;
    findBySetorIds(setorIds: string[], ativo?: boolean): Promise<ServiceType[]>;
    save(type: ServiceType): Promise<void>;
}
