import type { Agendamento } from '../../../domain/service/Agendamento';
import type { AgendamentoNotificacaoRepository } from '../../../domain/service/AgendamentoNotificacaoRepository';
import type { ServiceSlotRepository } from '../../../domain/service/ServiceSlotRepository';
import type { ServiceTypeRepository } from '../../../domain/service/ServiceTypeRepository';

export class NotificacaoService {
    constructor(
        private readonly notificacaoRepo: AgendamentoNotificacaoRepository,
        private readonly slotRepo: ServiceSlotRepository,
        private readonly typeRepo: ServiceTypeRepository,
    ) {}

    async enviarConfirmacao(agendamento: Agendamento): Promise<void> {
        const slot = await this.slotRepo.findById(agendamento.slotId);
        const serviceType = await this.typeRepo.findById(agendamento.serviceTypeId);
        if (!slot || !serviceType) return;

        const mensagem = this.montarMensagem(
            agendamento.clienteNome,
            serviceType.nome,
            slot.dataInicio,
            slot.local ?? null,
            agendamento.bairro ?? null,
            agendamento.id,
        );

        if (agendamento.clienteEmail) {
            try {
                const { invoke } = await import('@tauri-apps/api/core');
                await invoke('send_email', {
                    to: agendamento.clienteEmail,
                    subject: `Confirmação de Agendamento — ${serviceType.nome}`,
                    body: mensagem,
                });
                await this.notificacaoRepo.registrar(agendamento.id, 'email', 'enviado');
            } catch (e) {
                await this.notificacaoRepo.registrar(agendamento.id, 'email', 'erro', String(e));
            }
        }

        if (agendamento.clienteTelefone) {
            const phone = agendamento.clienteTelefone.replace(/\D/g, '');
            if (phone.length < 10) return;
            const waLink = `https://wa.me/55${phone}?text=${encodeURIComponent(mensagem)}`;
            await this.notificacaoRepo.registrar(agendamento.id, 'whatsapp', 'pendente_envio', waLink);
        }
    }

    private montarMensagem(
        clienteNome: string,
        tipoNome: string,
        dataInicio: string,
        local: string | null,
        bairro: string | null,
        protocolo: string,
    ): string {
        const [y, m, d] = dataInicio.slice(0, 10).split('-');
        const data = `${d}/${m}/${y}`;
        return [
            `Olá, ${clienteNome}!`,
            ``,
            `Seu agendamento foi confirmado:`,
            `Serviço: ${tipoNome}`,
            `Data: ${data}`,
            local  ? `Local: ${local}`   : '',
            bairro ? `Bairro: ${bairro}` : '',
            ``,
            `Protocolo: ${protocolo}`,
            ``,
            `Em caso de dúvidas, entre em contato com a equipe.`,
        ].filter(Boolean).join('\n');
    }
}
