import { ProjectStatus, isValidProjectTransition, isTerminalProjectStatus } from './ProjectStatus';

export interface ProjectProps {
    id: string;
    nome: string;
    descricao?: string | null;
    cor: string;
    criadoPor: string;
    arquivadoEm: string | null;
    arquivadoPor: string | null;
    status: ProjectStatus;
    criadoEm: string;
    atualizadoEm: string;
}

export class Project {
    private constructor(private props: ProjectProps) {}

    static fromProps(props: ProjectProps): Project {
        return new Project({ ...props });
    }

    toProps(): ProjectProps {
        return { ...this.props };
    }

    get id(): string { return this.props.id; }
    get nome(): string { return this.props.nome; }
    get descricao(): string | null | undefined { return this.props.descricao; }
    get cor(): string { return this.props.cor; }
    get criadoPor(): string { return this.props.criadoPor; }
    get arquivado(): boolean { return this.props.arquivadoEm != null; }
    get arquivadoEm(): string | null { return this.props.arquivadoEm; }
    get arquivadoPor(): string | null { return this.props.arquivadoPor; }
    get status(): ProjectStatus { return this.props.status; }
    get criadoEm(): string { return this.props.criadoEm; }
    get atualizadoEm(): string { return this.props.atualizadoEm; }

    transitionTo(newStatus: ProjectStatus): void {
        if (!isValidProjectTransition(this.props.status, newStatus)) {
            throw new Error(`Transição inválida: ${this.props.status} → ${newStatus}`);
        }
        this.props.status = newStatus;
        this.props.atualizadoEm = new Date().toISOString();
    }

    isTerminal(): boolean {
        return isTerminalProjectStatus(this.props.status);
    }

    arquivar(arquivadoPor: string): void {
        this.props.arquivadoEm = new Date().toISOString();
        this.props.arquivadoPor = arquivadoPor;
        this.props.atualizadoEm = this.props.arquivadoEm;
    }

    desarquivar(): void {
        this.props.arquivadoEm = null;
        this.props.arquivadoPor = null;
        this.props.atualizadoEm = new Date().toISOString();
    }

    updateNome(nome: string): void {
        this.props.nome = nome;
        this.props.atualizadoEm = new Date().toISOString();
    }

    updateDescricao(descricao: string): void {
        this.props.descricao = descricao;
        this.props.atualizadoEm = new Date().toISOString();
    }
}
