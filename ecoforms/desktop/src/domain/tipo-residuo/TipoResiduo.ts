export interface TipoResiduoProps {
    id: string;
    codigo: string;
    nome: string;
    descricao: string | null;
    cor: string;
    ativo: boolean;
    criadoEm: string;
}

export class TipoResiduo {
    private constructor(private readonly props: TipoResiduoProps) {}

    static fromProps(props: TipoResiduoProps): TipoResiduo {
        return new TipoResiduo(props);
    }

    static fromRow(row: {
        id: string;
        codigo: string;
        nome: string;
        descricao: string | null;
        cor: string;
        ativo: number;
        criado_em: string;
    }): TipoResiduo {
        return new TipoResiduo({
            id: row.id,
            codigo: row.codigo,
            nome: row.nome,
            descricao: row.descricao,
            cor: row.cor,
            ativo: row.ativo === 1,
            criadoEm: row.criado_em,
        });
    }

    get id(): string { return this.props.id; }
    get codigo(): string { return this.props.codigo; }
    get nome(): string { return this.props.nome; }
    get descricao(): string | null { return this.props.descricao; }
    get cor(): string { return this.props.cor; }
    get ativo(): boolean { return this.props.ativo; }
    get criadoEm(): string { return this.props.criadoEm; }

    toRow(): {
        id: string;
        codigo: string;
        nome: string;
        descricao: string | null;
        cor: string;
        ativo: number;
        criado_em: string;
    } {
        return {
            id: this.props.id,
            codigo: this.props.codigo,
            nome: this.props.nome,
            descricao: this.props.descricao,
            cor: this.props.cor,
            ativo: this.props.ativo ? 1 : 0,
            criado_em: this.props.criadoEm,
        };
    }
}
