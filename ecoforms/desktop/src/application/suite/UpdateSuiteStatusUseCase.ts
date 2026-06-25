import type { SuiteRepository } from '../../domain/suite/SuiteRepository';
import type { ClockPort } from '../ports/ClockPort';
import type { SuiteStatus } from '../../domain/suite/SuiteStatus';

export interface UpdateSuiteStatusInput {
    packageId: string;
    newStatus: SuiteStatus;
    revisorId?: string;
    motivo?: string;
    notes?: string;
    payloadPatch?: Record<string, unknown>;
}

export class UpdateSuiteStatusUseCase {
    constructor(
        private readonly suites: SuiteRepository,
        private readonly clock: ClockPort,
    ) {}

    async execute(input: UpdateSuiteStatusInput): Promise<void> {
        const pkg = await this.suites.findById(input.packageId);
        if (!pkg) throw new Error('Pacote não encontrado ou já arquivado');

        const statusAnterior = pkg.status;
        const newVersionNo = pkg.versionNo + 1;
        const now = this.clock.nowIso();

        let payload: Record<string, unknown>;
        try {
            payload = JSON.parse(pkg.payloadJson);
        } catch {
            payload = {};
        }

        if (input.payloadPatch) {
            Object.assign(payload, input.payloadPatch);
        }

        if (input.revisorId || input.motivo || input.notes) {
            if (!payload.meta || typeof payload.meta !== 'object') payload.meta = {};
            const meta = payload.meta as Record<string, unknown>;
            if (input.revisorId) meta.revisor_id = input.revisorId;
            if (input.motivo) meta.motivo_revisao = input.motivo;
            if (input.notes) meta.notas_revisao = input.notes;
            meta.revisado_em = now;
        }

        const newPayload = JSON.stringify(payload);

        // Invalidate current version
        await this.suites.invalidateCurrent(input.packageId);

        // Create new version
        const newPkg = pkg.createNewVersion(newPayload, now);
        newPkg.transitionTo(input.newStatus);
        await this.suites.save(newPkg);

        // Append history
        await this.suites.appendHistory({
            packageId: input.packageId,
            versionFrom: pkg.versionNo,
            versionTo: newVersionNo,
            statusAnterior,
            statusNovo: input.newStatus,
            alteradoPor: input.revisorId ?? null,
            motivo: input.motivo?.trim() || null,
        });
    }
}
