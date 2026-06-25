import type { Ecoponto } from './Ecoponto';

export interface EcopontoRepository {
    findAll(apenasAtivos?: boolean): Promise<Ecoponto[]>;
    findById(id: string): Promise<Ecoponto | null>;
    save(ecoponto: Ecoponto): Promise<void>;
}
