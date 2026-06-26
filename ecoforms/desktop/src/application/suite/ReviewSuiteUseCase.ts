import { NotFoundError } from '../../domain/shared/errors';
import type { SuiteRepository } from '../../domain/suite/SuiteRepository';
import type { ClockPort } from '../ports/ClockPort';
import type { SyncOutbox } from '../ports/SyncOutboxPort';
import type { ReviewSuiteInput, SuiteDto } from './dto/SuiteDto';
import { toSuiteDto } from './mappers';

export class ReviewSuiteUseCase {
    constructor(
        private readonly suites: SuiteRepository,
        private readonly clock: ClockPort,
        private readonly sync: SyncOutbox,
    ) {}

    async execute(input: ReviewSuiteInput): Promise<SuiteDto> {
        const pkg = await this.suites.findById(input.packageId);
        if (!pkg) throw new NotFoundError('SuitePackage', input.packageId);

        const statusAnterior = pkg.status;
        if (input.approve) {
            pkg.transitionTo('current');
        } else {
            pkg.transitionTo('refuted');
        }
        await this.suites.save(pkg);

        if (input.approve) {
            await this.sync.write('suite.aprovado', { packageId: pkg.packageId },
                { aggregateId: pkg.packageId });
        }

        await this.suites.appendHistory({
            packageId: pkg.packageId,
            versionFrom: pkg.versionNo,
            versionTo: pkg.versionNo,
            statusAnterior,
            statusNovo: pkg.status,
            alteradoPor: input.reviewerId,
            motivo: input.motivo ?? null,
        });

        void this.clock;

        return toSuiteDto(pkg);
    }
}
