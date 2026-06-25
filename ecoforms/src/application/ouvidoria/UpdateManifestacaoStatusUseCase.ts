import type { ManifestacaoRepository } from '../../domain/ouvidoria/ManifestacaoRepository';
import type { SyncOutbox } from '../../infrastructure/sync/SyncOutbox';
import type { TaskProjectionService } from '../task/TaskProjectionService';
import { ManifestacaoStateMachine } from '../../domain/ouvidoria/ManifestacaoStateMachine';

export interface UpdateManifestacaoStatusDTO {
    id: string;
    status: string;
    responsavelId?: string;
    encaminhadoPor?: string;
}

export class UpdateManifestacaoStatusUseCase {
    constructor(
        private readonly manifestacaoRepository: ManifestacaoRepository,
        private readonly sync: SyncOutbox,
        private readonly taskProjection?: TaskProjectionService,
    ) {}

    async execute(dto: UpdateManifestacaoStatusDTO): Promise<void> {
        const manifestacao = await this.manifestacaoRepository.findById(dto.id);
        if (!manifestacao) throw new Error('Manifestação não encontrada');

        ManifestacaoStateMachine.validarTransicao(manifestacao.status, dto.status);

        await this.manifestacaoRepository.updateStatus(dto.id, dto.status, dto.responsavelId);

        // NOTA (RN-O09): a projeção direta de Task disparava em status === 'encaminhada',
        // valor inexistente na FSM (o estado real é 'encaminhado_sema') — era código morto.
        // A integração ouvidoria→trabalho ocorre via Demanda, não por projeção direta aqui.

        await this.sync.write('manifestacao.status_atualizado', {
            manifestacaoId: dto.id,
            status: dto.status,
        }, { aggregateId: dto.id });
    }
}
