export interface ServiceTypeProps {
    id: string;
    nome: string;
    descricao?: string | null;
    formId?: string | null;
    validatorKey?: string | null;
    requerFotos: boolean;
    bairrosObrigatorios: boolean;
    requerMapa: boolean;
    capacidadePadrao?: number | null;
    icone?: string | null;
    cor?: string | null;
    ativo: boolean;
    aberturaRegra?: string | null;
    setorId?: string | null;
    criadoEm: string;
    atualizadoEm: string;
}

export class ServiceType {
    private constructor(private props: ServiceTypeProps) {}

    static fromProps(props: ServiceTypeProps): ServiceType {
        if (!props.id) throw new Error('ServiceType requer id');
        if (!props.nome?.trim()) throw new Error('ServiceType requer nome');
        return new ServiceType({ ...props });
    }

    toProps(): ServiceTypeProps { return { ...this.props }; }

    get id(): string { return this.props.id; }
    get nome(): string { return this.props.nome; }
    get descricao(): string | null | undefined { return this.props.descricao; }
    get formId(): string | null | undefined { return this.props.formId; }
    get validatorKey(): string | null | undefined { return this.props.validatorKey; }
    get requerFotos(): boolean { return this.props.requerFotos; }
    get bairrosObrigatorios(): boolean { return this.props.bairrosObrigatorios; }
    get requerMapa(): boolean { return this.props.requerMapa; }
    get capacidadePadrao(): number | null | undefined { return this.props.capacidadePadrao; }
    get icone(): string | null | undefined { return this.props.icone; }
    get cor(): string | null | undefined { return this.props.cor; }
    get ativo(): boolean { return this.props.ativo; }
    get aberturaRegra(): string | null | undefined { return this.props.aberturaRegra; }
    get setorId(): string | null | undefined { return this.props.setorId; }

    toSyncJSON(): Record<string, unknown> {
        return {
            id: this.props.id,
            nome: this.props.nome,
            descricao: this.props.descricao ?? null,
            form_id: this.props.formId ?? null,
            validator_key: this.props.validatorKey ?? null,
            requer_fotos: this.props.requerFotos ? 1 : 0,
            bairros_obrigatorios: this.props.bairrosObrigatorios ? 1 : 0,
            requer_mapa: this.props.requerMapa ? 1 : 0,
            capacidade_padrao: this.props.capacidadePadrao ?? null,
            icone: this.props.icone ?? null,
            cor: this.props.cor ?? null,
            ativo: this.props.ativo ? 1 : 0,
            abertura_regra: this.props.aberturaRegra ?? null,
            setor_id: this.props.setorId ?? null,
            criado_em: this.props.criadoEm,
            atualizado_em: this.props.atualizadoEm,
        };
    }
}
