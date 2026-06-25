export type NotificacaoSolicitanteStatus = 'pendente' | 'enviado' | 'falhou';

export interface NotificacaoSolicitanteProps {
    id: string;
    manifestacaoId: string;
    canal: string;
    conteudo: string;
    enviadoEm: string | null;
    status: NotificacaoSolicitanteStatus;
    usuarioId: string;
    criadoEm: string;
}

export class NotificacaoSolicitante {
    private constructor(private readonly props: NotificacaoSolicitanteProps) {}

    static fromProps(props: NotificacaoSolicitanteProps): NotificacaoSolicitante {
        return new NotificacaoSolicitante(props);
    }

    static fromRow(row: {
        id: string;
        manifestacao_id: string;
        canal: string;
        conteudo: string;
        enviado_em: string | null;
        status: string;
        usuario_id: string;
        criado_em: string;
    }): NotificacaoSolicitante {
        return new NotificacaoSolicitante({
            id: row.id,
            manifestacaoId: row.manifestacao_id,
            canal: row.canal,
            conteudo: row.conteudo,
            enviadoEm: row.enviado_em,
            status: row.status as NotificacaoSolicitanteStatus,
            usuarioId: row.usuario_id,
            criadoEm: row.criado_em,
        });
    }

    get id(): string { return this.props.id; }
    get manifestacaoId(): string { return this.props.manifestacaoId; }
    get canal(): string { return this.props.canal; }
    get conteudo(): string { return this.props.conteudo; }
    get enviadoEm(): string | null { return this.props.enviadoEm; }
    get status(): NotificacaoSolicitanteStatus { return this.props.status; }
    get usuarioId(): string { return this.props.usuarioId; }
    get criadoEm(): string { return this.props.criadoEm; }

    toRow(): {
        id: string;
        manifestacao_id: string;
        canal: string;
        conteudo: string;
        enviado_em: string | null;
        status: string;
        usuario_id: string;
        criado_em: string;
    } {
        return {
            id: this.props.id,
            manifestacao_id: this.props.manifestacaoId,
            canal: this.props.canal,
            conteudo: this.props.conteudo,
            enviado_em: this.props.enviadoEm,
            status: this.props.status,
            usuario_id: this.props.usuarioId,
            criado_em: this.props.criadoEm,
        };
    }
}
