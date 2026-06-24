import type { TipoResiduo } from './TipoResiduo';

export interface TipoResiduoRepository {
    findAll(): Promise<TipoResiduo[]>;
    findAtivos(): Promise<TipoResiduo[]>;
    findById(id: string): Promise<TipoResiduo | null>;
    findByCodigo(codigo: string): Promise<TipoResiduo | null>;
    save(tipo: TipoResiduo): Promise<void>;
    delete(id: string): Promise<void>;
}
