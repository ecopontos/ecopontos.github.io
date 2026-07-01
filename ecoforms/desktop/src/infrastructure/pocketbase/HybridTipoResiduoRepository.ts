import type { TipoResiduo } from '../../domain/tipo-residuo/TipoResiduo';
import type { TipoResiduoRepository } from '../../domain/tipo-residuo/TipoResiduoRepository';

function describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

export class HybridTipoResiduoRepository implements TipoResiduoRepository {
    constructor(
        private readonly local: TipoResiduoRepository,
        private readonly remote: TipoResiduoRepository,
    ) {}

    findAll(): Promise<TipoResiduo[]> {
        return this.local.findAll();
    }

    findAtivos(): Promise<TipoResiduo[]> {
        return this.local.findAtivos();
    }

    findById(id: string): Promise<TipoResiduo | null> {
        return this.local.findById(id);
    }

    findByCodigo(codigo: string): Promise<TipoResiduo | null> {
        return this.local.findByCodigo(codigo);
    }

    async save(tipo: TipoResiduo): Promise<void> {
        await this.local.save(tipo);
        await this.replicate(() => this.remote.save(tipo), 'save', tipo.id);
    }

    async delete(id: string): Promise<void> {
        await this.local.delete(id);
        await this.replicate(() => this.remote.delete(id), 'delete', id);
    }

    private async replicate(operation: () => Promise<void>, action: string, id: string): Promise<void> {
        try {
            await operation();
        } catch (error) {
            console.warn(`[PocketBase POC] tipo_residuo ${action} remoto falhou para ${id}: ${describeError(error)}`);
        }
    }
}
