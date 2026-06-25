import { SuitePackage } from '../../domain/suite/SuitePackage';
import type { SuiteRepository } from '../../domain/suite/SuiteRepository';
import type { ClockPort } from '../ports/ClockPort';
import type { SubmitSuiteInput, SuiteDto } from './dto/SuiteDto';
import { toSuiteDto } from './mappers';
import { CycleDetectedError } from '../../domain/shared/errors';
import { uuidv7 } from 'ecoforms-core';

export class SubmitSuiteUseCase {
    constructor(
        private readonly suites: SuiteRepository,
        private readonly clock: ClockPort,
    ) {}

    async execute(input: SubmitSuiteInput): Promise<SuiteDto> {
        const now = this.clock.nowIso();
        const pkgId = uuidv7();

        // GAP-007: Validar ausência de referência cíclica
        if (input.refPackageId) {
            const safe = await this.suites.validateNoCycle(pkgId, input.refPackageId);
            if (!safe) {
                throw new CycleDetectedError(pkgId, input.refPackageId);
            }
        }

        const pkg = SuitePackage.fromProps({
            packageId: pkgId,
            versionNo: 1,
            moduleType: input.moduleType,
            resourceType: input.resourceType,
            status: 'current',
            ownerId: input.ownerId,
            isCurrent: true,
            lockedBy: null,
            lockedAt: null,
            refPackageId: input.refPackageId ?? null,
            refPackageVer: input.refPackageVer ?? null,
            entityId: input.entityId ?? null,
            entityType: input.entityType ?? null,
            payloadJson: JSON.stringify(input.payload ?? {}),
            createdAt: now,
            closedAt: null,
        });

        await this.suites.save(pkg);
        await this.suites.appendHistory({
            packageId: pkg.packageId,
            versionFrom: null,
            versionTo: 1,
            statusAnterior: null,
            statusNovo: 'current',
            alteradoPor: input.ownerId,
            motivo: 'submissão inicial',
        });

        return toSuiteDto(pkg);
    }
}
