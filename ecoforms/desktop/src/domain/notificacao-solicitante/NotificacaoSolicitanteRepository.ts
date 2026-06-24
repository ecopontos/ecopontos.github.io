import type { NotificacaoSolicitante, NotificacaoSolicitanteStatus } from './NotificacaoSolicitante';

export interface NotificacaoSolicitanteRepository {
    findAll(): Promise<NotificacaoSolicitante[]>;
    findByManifestacao(manifestacaoId: string): Promise<NotificacaoSolicitante[]>;
    findByUsuario(usuarioId: string): Promise<NotificacaoSolicitante[]>;
    findByStatus(status: NotificacaoSolicitanteStatus): Promise<NotificacaoSolicitante[]>;
    findById(id: string): Promise<NotificacaoSolicitante | null>;
    save(notificacao: NotificacaoSolicitante): Promise<void>;
    delete(id: string): Promise<void>;
}
