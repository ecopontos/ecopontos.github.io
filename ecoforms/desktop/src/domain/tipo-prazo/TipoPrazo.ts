export interface TipoPrazoProps {
    id: string;
    nome: string;
    diasPadrao: number | null;
    ativo: boolean;
    criadoEm: string;
}

export class TipoPrazo {
    private constructor(private readonly props: TipoPrazoProps) {}

    static fromProps(props: TipoPrazoProps): TipoPrazo {
        return new TipoPrazo(props);
    }

    static fromRow(row: { id: string; nome: string; dias_padrao: number | null; ativo: number; criado_em: string }): TipoPrazo {
        return new TipoPrazo({
            id: row.id,
            nome: row.nome,
            diasPadrao: row.dias_padrao,
            ativo: row.ativo === 1,
            criadoEm: row.criado_em,
        });
    }

    get id(): string { return this.props.id; }
    get nome(): string { return this.props.nome; }
    get diasPadrao(): number | null { return this.props.diasPadrao; }
    get ativo(): boolean { return this.props.ativo; }
    get criadoEm(): string { return this.props.criadoEm; }

    toRow(): { id: string; nome: string; dias_padrao: number | null; ativo: number; criado_em: string } {
        return {
            id: this.props.id,
            nome: this.props.nome,
            dias_padrao: this.props.diasPadrao,
            ativo: this.props.ativo ? 1 : 0,
            criado_em: this.props.criadoEm,
        };
    }
}
