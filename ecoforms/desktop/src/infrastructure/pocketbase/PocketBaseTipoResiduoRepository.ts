import { TipoResiduo } from '../../domain/tipo-residuo/TipoResiduo';
import type { TipoResiduoRepository } from '../../domain/tipo-residuo/TipoResiduoRepository';
import type { PocketBaseClient } from './PocketBaseClient';

interface PocketBaseTipoResiduoRecord {
    id: string;
    codigo: string;
    nome: string;
    descricao?: string | null;
    cor: string;
    ativo: boolean;
    criado_em?: string;
    created?: string;
}

function escapeFilterValue(value: string): string {
    return value.split('\\').join('\\\\').split('"').join('\\"');
}

function recordToEntity(record: PocketBaseTipoResiduoRecord): TipoResiduo {
    return TipoResiduo.fromRow({
        id: record.id,
        codigo: record.codigo,
        nome: record.nome,
        descricao: record.descricao ?? null,
        cor: record.cor,
        ativo: record.ativo ? 1 : 0,
        criado_em: record.criado_em ?? record.created ?? new Date().toISOString(),
    });
}

export class PocketBaseTipoResiduoRepository implements TipoResiduoRepository {
    constructor(
        private readonly client: PocketBaseClient,
        private readonly collection: string,
    ) {}

    async findAll(): Promise<TipoResiduo[]> {
        const response = await this.client.listRecords<PocketBaseTipoResiduoRecord>(this.collection, {
            page: 1,
            perPage: 500,
            sort: 'nome',
        });
        return response.items.map(recordToEntity);
    }

    async findAtivos(): Promise<TipoResiduo[]> {
        const response = await this.client.listRecords<PocketBaseTipoResiduoRecord>(this.collection, {
            page: 1,
            perPage: 500,
            sort: 'nome',
            filter: 'ativo = true',
        });
        return response.items.map(recordToEntity);
    }

    async findById(id: string): Promise<TipoResiduo | null> {
        try {
            return recordToEntity(await this.client.getRecord<PocketBaseTipoResiduoRecord>(this.collection, id));
        } catch {
            return null;
        }
    }

    async findByCodigo(codigo: string): Promise<TipoResiduo | null> {
        const filter = `codigo = "${escapeFilterValue(codigo)}"`;
        const response = await this.client.listRecords<PocketBaseTipoResiduoRecord>(this.collection, {
            page: 1,
            perPage: 1,
            filter,
        });
        return response.items[0] ? recordToEntity(response.items[0]) : null;
    }

    async save(tipo: TipoResiduo): Promise<void> {
        const row = tipo.toRow();
        await this.client.upsertRecord(this.collection, row.id, {
            codigo: row.codigo,
            nome: row.nome,
            descricao: row.descricao,
            cor: row.cor,
            ativo: row.ativo === 1,
            criado_em: row.criado_em,
        });
    }

    async delete(id: string): Promise<void> {
        await this.client.deleteRecord(this.collection, id);
    }
}
