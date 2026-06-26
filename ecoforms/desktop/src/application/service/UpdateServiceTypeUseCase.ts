import type { ServiceTypeRepository } from '../../domain/service/ServiceTypeRepository';
import type { SqlitePort } from '../ports/SqlitePort';
import { getEffectiveSectors } from '../shared/SectorQueryUtils';
import { ForbiddenError } from '../../domain/shared/errors';

export interface UpdateServiceTypeInput {
    id: string;
    nome?: string;
    descricao?: string | null;
    formId?: string | null;
    validatorKey?: string | null;
    requerFotos?: boolean;
    bairrosObrigatorios?: boolean;
    requerMapa?: boolean;
    capacidadePadrao?: number | null;
    icone?: string | null;
    cor?: string | null;
    ativo?: boolean;
    setorId?: string | null;
}

export class UpdateServiceTypeUseCase {
    constructor(
        private readonly repo: ServiceTypeRepository,
        private readonly db: SqlitePort,
    ) {}

    async execute(input: UpdateServiceTypeInput, actorId: string): Promise<void> {
        const type = await this.repo.findById(input.id);
        if (!type) throw new Error(`Tipo de serviço '${input.id}' não encontrado`);

        const isAdmin = await this.isUserAdmin(actorId);
        const existingSetorId = type.setorId ?? null;

        if (!isAdmin && existingSetorId) {
            const sectors = await getEffectiveSectors(actorId, this.db);
            if (!sectors.includes(existingSetorId)) {
                throw new ForbiddenError(`Você não tem permissão para editar este tipo de serviço`);
            }
        }

        const validatedSetorId = input.setorId !== undefined
            ? await this.validateSetorChange(input.setorId, actorId)
            : undefined;

        const p = type.toProps();
        const updated = {
            ...p,
            ...(input.nome !== undefined && { nome: input.nome }),
            ...(input.descricao !== undefined && { descricao: input.descricao }),
            ...(input.formId !== undefined && { formId: input.formId }),
            ...(input.validatorKey !== undefined && { validatorKey: input.validatorKey }),
            ...(input.requerFotos !== undefined && { requerFotos: input.requerFotos }),
            ...(input.bairrosObrigatorios !== undefined && { bairrosObrigatorios: input.bairrosObrigatorios }),
            ...(input.requerMapa !== undefined && { requerMapa: input.requerMapa }),
            ...(input.capacidadePadrao !== undefined && { capacidadePadrao: input.capacidadePadrao }),
            ...(input.icone !== undefined && { icone: input.icone }),
            ...(input.cor !== undefined && { cor: input.cor }),
            ...(input.ativo !== undefined && { ativo: input.ativo }),
            ...(validatedSetorId !== undefined && { setorId: validatedSetorId }),
            atualizadoEm: new Date().toISOString(),
        };

        const { ServiceType } = await import('../../domain/service/ServiceType');
        await this.repo.save(ServiceType.fromProps(updated));
    }

    private async validateSetorChange(setorId: string | null, userId: string): Promise<string | null> {
        if (!setorId) return null;

        const effective = await getEffectiveSectors(userId, this.db);
        if (effective.length > 0 && !effective.includes(setorId)) {
            throw new ForbiddenError(`Setor '${setorId}' fora do escopo do usuário`);
        }

        return setorId;
    }

    private async isUserAdmin(userId: string): Promise<boolean> {
        const rows = await this.db.query<{ perfil: string }>(
            `SELECT perfil FROM usuarios WHERE id = ? LIMIT 1`,
            [userId],
        );
        return rows[0]?.perfil === 'admin';
    }
}
