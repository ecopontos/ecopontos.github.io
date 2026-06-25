import type { TipoPrazo } from './TipoPrazo';

export interface TipoPrazoRepository {
    findAll(): Promise<TipoPrazo[]>;
    findAtivos(): Promise<TipoPrazo[]>;
    findById(id: string): Promise<TipoPrazo | null>;
    save(tipo: TipoPrazo): Promise<void>;
    delete(id: string): Promise<void>;
}
