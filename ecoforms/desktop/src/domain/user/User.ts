export interface UserProps {
    id: string;
    nome: string;
    username: string;
    email?: string;
    perfil: string;
    ativo: boolean;
    passwordHash?: string;
    setores: string[];
    criadoEm?: string;
    atualizadoEm?: string;
}

export class User {
    private constructor(private props: UserProps) {}

    static fromProps(props: UserProps): User {
        return new User({ ...props, setores: [...(props.setores || [])] });
    }

    toProps(): UserProps {
        return { ...this.props, setores: [...this.props.setores] };
    }

    get id(): string { return this.props.id; }
    get nome(): string { return this.props.nome; }
    get ativo(): boolean { return this.props.ativo; }
    get passwordHash(): string | undefined { return this.props.passwordHash; }
    get setores(): string[] { return [...this.props.setores]; }

    toggleActive(): void {
        this.props.ativo = !this.props.ativo;
    }

    update(data: Partial<UserProps>): void {
        if (data.nome) this.props.nome = data.nome;
        if (data.username) this.props.username = data.username;
        if (data.email !== undefined) this.props.email = data.email;
        if (data.perfil) this.props.perfil = data.perfil;
        if (data.passwordHash !== undefined) this.props.passwordHash = data.passwordHash;
        if (data.setores) this.props.setores = [...data.setores];
    }
}
