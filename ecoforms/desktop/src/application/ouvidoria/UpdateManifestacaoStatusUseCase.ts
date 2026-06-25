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

        if (dto.status === 'encaminhada' && this.taskProjection) {
            await this.taskProjection.project({
                titulo:        `[Manifestação] ${manifestacao.assunto}`,
                setorId:       manifestacao.setorId ?? null,
                atribuidoPara: dto.responsavelId ?? manifestacao.responsavelId,
                prazo:         manifestacao.prazoLimite,
                criadoPor:     dto.encaminhadoPor ?? dto.responsavelId ?? 'system',
                origemTipo:    'manifestacao',
                origemId:      dto.id,
            });
        }

        await this.sync.write('manifestacao.status_atualizado', {
            manifestacaoId: dto.id,
            status: dto.status,
        }, { aggregateId: dto.id });
    }
}
