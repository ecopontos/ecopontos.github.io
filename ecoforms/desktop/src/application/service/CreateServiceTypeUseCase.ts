import { uuidv7 } from 'ecoforms-core';
import { ServiceType } from '../../domain/service/ServiceType';
import type { ServiceTypeRepository } from '../../domain/service/ServiceTypeRepository';
import type { SqlitePort } from '../ports/SqlitePort';
import { getEffectiveSectors } from '../shared/SectorQueryUtils';
import { ForbiddenError } from '../../domain/shared/errors';

export interface CreateServiceTypeInput {
    nome: string;
    descricao?: string;
    formId?: string;
    validatorKey?: string;
    requerFotos?: boolean;
    bairrosObrigatorios?: boolean;
    requerMapa?: boolean;
    capacidadePadrao?: number;
    icone?: string;
    cor?: string;
    setorId?: string;
}

export class CreateServiceTypeUseCase {
    constructor(
        private readonly repo: ServiceTypeRepository,
        private readonly db: SqlitePort,
    ) {}

    async execute(input: CreateServiceTypeInput, actorId: string): Promise<string> {
        const validatedSetorId = await this.validateSetor(input.setorId ?? null, actorId);

        const id = uuidv7();
        const now = new Date().toISOString();

        const type = ServiceType.fromProps({
            id,
            nome: input.nome,
            descricao: input.descricao ?? null,
            formId: input.formId ?? null,
            validatorKey: input.validatorKey ?? null,
            requerFotos: input.requerFotos ?? false,
            bairrosObrigatorios: input.bairrosObrigatorios ?? false,
            requerMapa: input.requerMapa ?? false,
            capacidadePadrao: input.capacidadePadrao ?? null,
            icone: input.icone ?? null,
            cor: input.cor ?? null,
            setorId: validatedSetorId,
            ativo: true,
            criadoEm: now,
            atualizadoEm: now,
        });

        await this.repo.save(type);
        return id;
    }

    private async validateSetor(setorId: string | null, userId: string): Promise<string | null> {
        if (!setorId) {
            const rows = await this.db.query<{ setor_principal_id: string | null }>(
                `SELECT setor_principal_id FROM usuarios WHERE id = ?`,
                [userId],
            );
            return rows[0]?.setor_principal_id ?? null;
        }

        const effective = await getEffectiveSectors(userId, this.db);
        if (effective.length > 0 && !effective.includes(setorId)) {
            throw new ForbiddenError(`Setor '${setorId}' fora do escopo do usuário`);
        }

        return setorId;
    }
}
