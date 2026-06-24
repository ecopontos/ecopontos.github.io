export interface HierarquiaPerfilProps {
    perfil: string;
    nivel: number;
    descricao: string | null;
}

export class HierarquiaPerfil {
    private constructor(private readonly props: HierarquiaPerfilProps) {}

    static fromProps(props: HierarquiaPerfilProps): HierarquiaPerfil {
        return new HierarquiaPerfil(props);
    }

    static fromRow(row: { perfil: string; nivel: number; descricao: string | null }): HierarquiaPerfil {
        return new HierarquiaPerfil({
            perfil: row.perfil,
            nivel: row.nivel,
            descricao: row.descricao,
        });
    }

    get perfil(): string { return this.props.perfil; }
    get nivel(): number { return this.props.nivel; }
    get descricao(): string | null { return this.props.descricao; }

    toRow(): { perfil: string; nivel: number; descricao: string | null } {
        return {
            perfil: this.props.perfil,
            nivel: this.props.nivel,
            descricao: this.props.descricao,
        };
    }
}
