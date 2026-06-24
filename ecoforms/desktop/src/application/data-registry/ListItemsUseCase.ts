import { DataRegistryItem } from '../../domain/data-registry/DataRegistryItem';
import type { DataRegistryRepository } from '../../domain/data-registry/DataRegistryRepository';
import type { ClockPort } from '../ports/ClockPort';
import type { CreateDataRegistryInput, DataRegistryDto } from './dto/DataRegistryDto';
import { toDataRegistryDto } from './mappers';
import { uuidv7 } from 'ecoforms-core';

export class ListItemsUseCase {
    constructor(private readonly repo: DataRegistryRepository) {}

    async execute(): Promise<DataRegistryDto[]> {
        const items = await this.repo.findAll();
        return items.map(toDataRegistryDto);
    }
}

export class CreateDataRegistryUseCase {
    constructor(
        private readonly repo: DataRegistryRepository,
        private readonly clock: ClockPort,
    ) {}

    async execute(input: CreateDataRegistryInput): Promise<DataRegistryDto> {
        const now = this.clock.nowIso();
        const item = DataRegistryItem.fromProps({
            id: uuidv7(),
            tipo: input.tipo,
            conteudo: input.conteudo,
            criadoEm: now,
            atualizadoEm: now,
        });
        await this.repo.save(item);
        return toDataRegistryDto(item);
    }
}

export class DeleteDataRegistryUseCase {
    constructor(private readonly repo: DataRegistryRepository) {}

    async execute(id: string): Promise<void> {
        await this.repo.delete(id);
    }
}

export interface SaveDataRegistryInput {
    id?: string;
    tipo: string;
    conteudo: unknown;
}

export class SaveDataRegistryUseCase {
    constructor(
        private readonly repo: DataRegistryRepository,
        private readonly clock: ClockPort,
    ) {}

    async execute(input: SaveDataRegistryInput): Promise<DataRegistryDto> {
        const now = this.clock.nowIso();
        const id = input.id ?? uuidv7();
        const item = DataRegistryItem.fromProps({
            id,
            tipo: input.tipo,
            conteudo: input.conteudo,
            criadoEm: now,
            atualizadoEm: now,
        });
        await this.repo.save(item);
        return toDataRegistryDto(item);
    }
}
