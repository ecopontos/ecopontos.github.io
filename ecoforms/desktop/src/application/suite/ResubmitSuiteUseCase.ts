import type { SuiteRepository } from '../../domain/suite/SuiteRepository';
import type { ClockPort } from '../ports/ClockPort';
import type { SyncOutbox } from '../../infrastructure/sync/SyncOutbox';

export interface ResubmitSuiteInput {
    packageId: string;
    moduleType: string;
    resourceType: string;
    versionNo: number;
    status: string;
    newPayload: string;
    userId?: string;
}

export class ResubmitSuiteUseCase {
    constructor(
        private readonly suites: SuiteRepository,
        private readonly clock: ClockPort,
        private readonly sync: SyncOutbox,
    ) {}

    async execute(input: ResubmitSuiteInput): Promise<void> {
        const now = this.clock.nowIso();
        const newVersionNo = input.versionNo + 1;

        await this.suites.invalidateCurrent(input.packageId);

        const pkg = await this.suites.findById(input.packageId);
        if (!pkg) throw new Error('Pacote não encontrado');

        const newPkg = pkg.createNewVersion(input.newPayload, now);
        newPkg.transitionTo('current');
        await this.suites.save(newPkg);

        await this.suites.appendHistory({
            packageId: input.packageId,
            versionFrom: input.versionNo,
            versionTo: newVersionNo,
            statusAnterior: input.status,
            statusNovo: 'current',
            alteradoPor: input.userId ?? null,
            motivo: 'Re-submissão após correção',
        });

        await this.sync.write('suite.editado', { packageId: input.packageId },
            { aggregateId: input.packageId });
    }
}
