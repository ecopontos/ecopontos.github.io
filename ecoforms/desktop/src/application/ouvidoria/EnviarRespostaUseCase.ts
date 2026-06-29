import { uuidv7 } from 'ecoforms-core';
import type {
    ManifestacaoRepository,
    CanalEnvio,
    StatusEnvio,
} from '../../domain/ouvidoria/ManifestacaoRepository';
import type { SyncOutbox } from '../ports/SyncOutboxPort';
import { ManifestacaoRespostaEnviada } from '../../domain/ouvidoria/ManifestacaoEvents';

export interface EnviarRespostaDTO {
    respostaId: string;
    manifestacaoId: string;
    canal: CanalEnvio;
    destinatario?: string | null;
    statusEnvio: StatusEnvio;
    erro?: string | null;
    /** Move a manifestação para 'respondida' após registrar o envio. */
    marcarRespondida?: boolean;
}

/**
 * Registra o envio de uma resposta ao cidadão por um canal (e-mail, WhatsApp,
 * portal, impresso), valida que a resposta existe e publica o evento de sync.
 *
 * A camada de apresentação (abrir WhatsApp, invocar SMTP via Tauri) permanece
 * no hook/UI — este use case cuida apenas de persistência + evento.
 */
export class EnviarRespostaUseCase {
    constructor(
        private readonly manifestacaoRepository: ManifestacaoRepository,
        private readonly sync: SyncOutbox,
    ) {}

    async execute(dto: EnviarRespostaDTO): Promise<string> {
        // 1. Valida que a resposta formatada existe
        const respostas = await this.manifestacaoRepository.listRespostas(dto.manifestacaoId);
        const resposta = respostas.find(r => r.id === dto.respostaId);
        if (!resposta) {
            throw new Error('Resposta não encontrada para envio');
        }

        // 2. Registra o canal em envios_resposta
        const envioId = uuidv7();
        const now = new Date().toISOString();
        await this.manifestacaoRepository.registrarEnvio({
            id: envioId,
            respostaId: dto.respostaId,
            manifestacaoId: dto.manifestacaoId,
            canal: dto.canal,
            destinatario: dto.destinatario ?? null,
            statusEnvio: dto.statusEnvio,
            dataEnvio: now,
            erro: dto.erro ?? null,
        });

        // 3. (Opcional) Move status da manifestação para 'respondida'
        if (dto.marcarRespondida) {
            await this.manifestacaoRepository.updateStatus(dto.manifestacaoId, 'respondida');
        }

        // 4. Publica evento de domínio para sync
        await this.sync.write(ManifestacaoRespostaEnviada, {
            envioId,
            respostaId: dto.respostaId,
            manifestacaoId: dto.manifestacaoId,
            canal: dto.canal,
            statusEnvio: dto.statusEnvio,
        }, { aggregateId: dto.manifestacaoId });

        return envioId;
    }
}
