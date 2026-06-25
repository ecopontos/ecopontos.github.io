import type { SuiteRepository } from '../../domain/suite/SuiteRepository';
import type { SuiteDto } from './dto/SuiteDto';
import { toSuiteDto } from './mappers';

export interface ListInboxInput {
    ownerId?: string;
    resourceType?: string;
    limit?: number;
}

export class ListInboxUseCase {
    constructor(private readonly suites: SuiteRepository) {}

    async execute(input: ListInboxInput): Promise<SuiteDto[]> {
        const pkgs = await this.suites.query({
            ownerId: input.ownerId,
            resourceType: input.resourceType,
            isCurrent: true,
            limit: input.limit,
        });
        return pkgs.map(toSuiteDto);
    }
}
