import type { ManifestacaoRepository } from '../../domain/ouvidoria/ManifestacaoRepository';
import type { SyncOutbox } from '../../infrastructure/sync/SyncOutbox';

export interface EnviarRespostaDTO {
    manifestacaoId: string;
    texto: string;
    enviadaPorId: string;
    canal?: 'email' | 'whatsapp' | 'portal' | 'impresso';
    destinatario?: string;
}

export class EnviarRespostaUseCase {
    constructor(
        private readonly manifestacaoRepository: ManifestacaoRepository,
        private readonly sync: SyncOutbox,
    ) {}

    async execute(dto: EnviarRespostaDTO): Promise<void> {
        const manifestacao = await this.manifestacaoRepository.findById(dto.manifestacaoId);
        if (!manifestacao) throw new Error('Manifestação não encontrada');

        const respostaId = crypto.randomUUID();
        const agora = new Date().toISOString();

        await this.manifestacaoRepository.addResposta({
            id: respostaId,
            manifestacaoId: dto.manifestacaoId,
            texto: dto.texto,
            enviadaPorId: dto.enviadaPorId,
            enviadaEm: agora,
        });

        if (dto.canal) {
            await this.manifestacaoRepository.registrarEnvio({
                id: crypto.randomUUID(),
                respostaId,
                manifestacaoId: dto.manifestacaoId,
                canal: dto.canal,
                destinatario: dto.destinatario ?? null,
                statusEnvio: 'pendente',
            });
        }

        await this.sync.write('manifestacao.resposta_enviada', {
            manifestacaoId: dto.manifestacaoId,
            respostaId,
            canal: dto.canal,
        }, { aggregateId: dto.manifestacaoId });
    }
}
