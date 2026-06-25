import type { DataRegistryItem } from './DataRegistryItem';

export interface DataRegistryRepository {
    findByTipo(tipo: string): Promise<DataRegistryItem[]>;
    findByTipoAndConteudo(tipo: string, conteudo: string): Promise<DataRegistryItem[]>;
    findAllTypes(): Promise<string[]>;
    findAll(): Promise<DataRegistryItem[]>;
    findById(id: string): Promise<DataRegistryItem | null>;
    save(item: DataRegistryItem): Promise<void>;
    delete(id: string): Promise<void>;
}
