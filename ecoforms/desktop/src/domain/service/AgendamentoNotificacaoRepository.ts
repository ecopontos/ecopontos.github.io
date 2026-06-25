export type CanalNotificacao = 'email' | 'whatsapp';
export type StatusNotificacao = 'enviado' | 'erro' | 'pendente_envio';

export interface AgendamentoNotificacao {
    id: string;
    agendamentoId: string;
    canal: CanalNotificacao;
    status: StatusNotificacao;
    detalhe?: string | null;
    criadoEm: string;
}

export interface AgendamentoNotificacaoRepository {
    registrar(
        agendamentoId: string,
        canal: CanalNotificacao,
        status: StatusNotificacao,
        detalhe?: string,
    ): Promise<void>;
    findByAgendamentoId(agendamentoId: string): Promise<AgendamentoNotificacao[]>;
    findLinkWhatsApp(agendamentoId: string): Promise<string | null>;
}
