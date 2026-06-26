import type { ServiceType } from '../../domain/service/ServiceType';
import type { ServiceTypeRepository } from '../../domain/service/ServiceTypeRepository';
import type { SqlitePort } from '../ports/SqlitePort';
import { getEffectiveSectors } from '../shared/SectorQueryUtils';

export class ListServiceTypesUseCase {
    constructor(
        private readonly repo: ServiceTypeRepository,
        private readonly db: SqlitePort,
    ) {}

    async execute(userId: string, ativo = true): Promise<ServiceType[]> {
        const isAdmin = await this.isUserAdmin(userId);
        if (isAdmin) return this.repo.findAll(ativo);

        const sectors = await getEffectiveSectors(userId, this.db);
        if (sectors.length === 0) return this.repo.findAll(ativo);

        return this.repo.findBySetorIds(sectors, ativo);
    }

    private async isUserAdmin(userId: string): Promise<boolean> {
        const rows = await this.db.query<{ perfil: string }>(
            `SELECT perfil FROM usuarios WHERE id = ? LIMIT 1`,
            [userId],
        );
        return rows[0]?.perfil === 'admin';
    }
}
