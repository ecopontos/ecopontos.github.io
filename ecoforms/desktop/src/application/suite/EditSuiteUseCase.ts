import { NotFoundError, SuiteLockedError } from '../../domain/shared/errors';
import type { SuiteRepository } from '../../domain/suite/SuiteRepository';
import type { ClockPort } from '../ports/ClockPort';
import type { SyncOutbox } from '../../infrastructure/sync/SyncOutbox';
import type { EditSuiteInput, SuiteDto } from './dto/SuiteDto';
import { toSuiteDto } from './mappers';

export class EditSuiteUseCase {
    constructor(
        private readonly suites: SuiteRepository,
        private readonly clock: ClockPort,
        private readonly sync: SyncOutbox,
    ) {}

    async execute(input: EditSuiteInput): Promise<SuiteDto> {
        const pkg = await this.suites.findById(input.packageId);
        if (!pkg) throw new NotFoundError('SuitePackage', input.packageId);

        const lockedBy = pkg.toProps().lockedBy;
        if (lockedBy && lockedBy !== input.editorId) {
            throw new SuiteLockedError(input.packageId, lockedBy);
        }

        const statusAnterior = pkg.status;
        const now = this.clock.nowIso();

        const newVersion = pkg.createNewVersion(JSON.stringify(input.payload ?? {}), now);

        if (newVersion.status !== 'edit') {
            newVersion.transitionTo('edit');
        }

        await this.suites.save(newVersion);

        await this.suites.appendHistory({
            packageId: newVersion.packageId,
            versionFrom: pkg.versionNo,
            versionTo: newVersion.versionNo,
            statusAnterior,
            statusNovo: newVersion.status,
            alteradoPor: input.editorId,
            motivo: 'edição de payload (nova versão)',
        });

        await this.sync.write('suite.editado', { packageId: newVersion.packageId },
            { aggregateId: newVersion.packageId });

        return toSuiteDto(newVersion);
    }
}
