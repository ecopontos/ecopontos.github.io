import type { DataRegistryItem } from '../../domain/data-registry/DataRegistryItem';
import type { DataRegistryDto } from './dto/DataRegistryDto';

export function toDataRegistryDto(item: DataRegistryItem): DataRegistryDto {
    const p = item.toProps();
    return {
        id: p.id,
        tipo: p.tipo,
        conteudo: p.conteudo,
        criadoEm: p.criadoEm,
        atualizadoEm: p.atualizadoEm,
    };
}
