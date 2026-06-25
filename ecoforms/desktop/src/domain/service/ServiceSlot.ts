export type StatusSlot = 'rascunho' | 'publicado' | 'encerrado' | 'cancelado';

const TRANSICOES: Record<StatusSlot, StatusSlot[]> = {
    rascunho:  ['publicado', 'cancelado'],
    publicado: ['encerrado', 'cancelado'],
    encerrado: [],
    cancelado: [],
};

export interface ServiceSlotProps {
    id: string;
    serviceTypeId: string;
    titulo: string;
    descricao?: string | null;
    dataInicio: string;
    dataFim: string;
    horarioInicio?: string | null;
    horarioFim?: string | null;
    tipoPrazo?: 'unico' | 'periodo' | 'recorrente' | null;
    recorrencia?: string | null;
    capacidade?: number | null;
    bairros?: string[];
    local?: string | null;
    vagasOcupadas: number;
    status: StatusSlot;
    aberturaEm?: string | null;
    criadoPor: string;
    criadoEm: string;
    atualizadoEm: string;
}

export class ServiceSlot {
    private constructor(private props: ServiceSlotProps) {}

    static fromProps(props: ServiceSlotProps): ServiceSlot {
        if (!props.id) throw new Error('ServiceSlot requer id');
        if (!props.titulo?.trim()) throw new Error('ServiceSlot requer título');
        if (new Date(props.dataFim) < new Date(props.dataInicio)) throw new Error('data_fim deve ser >= data_inicio');
        return new ServiceSlot({ ...props, vagasOcupadas: props.vagasOcupadas ?? 0 });
    }

    toProps(): ServiceSlotProps { return { ...this.props }; }

    get id(): string { return this.props.id; }
    get serviceTypeId(): string { return this.props.serviceTypeId; }
    get titulo(): string { return this.props.titulo; }
    get status(): StatusSlot { return this.props.status; }
    get capacidade(): number | null | undefined { return this.props.capacidade; }
    get vagasOcupadas(): number { return this.props.vagasOcupadas; }
    get bairros(): string[] { return this.props.bairros ?? []; }
    get dataInicio(): string { return this.props.dataInicio; }
    get dataFim(): string { return this.props.dataFim; }
    get tipoPrazo(): 'unico' | 'periodo' | 'recorrente' | null | undefined { return this.props.tipoPrazo; }
    get recorrencia(): string | null | undefined { return this.props.recorrencia; }
    get descricao(): string | null | undefined { return this.props.descricao; }
    get local(): string | null | undefined { return this.props.local; }
    get horarioInicio(): string | null | undefined { return this.props.horarioInicio; }
    get horarioFim(): string | null | undefined { return this.props.horarioFim; }
    get aberturaEm(): string | null | undefined { return this.props.aberturaEm; }
    get criadoPor(): string { return this.props.criadoPor; }

    podeTransitarPara(novoStatus: StatusSlot): boolean {
        return TRANSICOES[this.props.status]?.includes(novoStatus) ?? false;
    }

    transitionTo(novoStatus: StatusSlot): void {
        if (!this.podeTransitarPara(novoStatus)) {
            throw new Error(`Transição inválida: '${this.props.status}' → '${novoStatus}'`);
        }
        this.props.status = novoStatus;
        this.props.atualizadoEm = new Date().toISOString();
    }

    incrementarVagas(qtd: number): void {
        this.props.vagasOcupadas += qtd;
        this.props.atualizadoEm = new Date().toISOString();
    }

    isTerminal(): boolean {
        return this.props.status === 'encerrado' || this.props.status === 'cancelado';
    }

    toSyncJSON(): Record<string, unknown> {
        return {
            id: this.props.id,
            service_type_id: this.props.serviceTypeId,
            titulo: this.props.titulo,
            descricao: this.props.descricao ?? null,
            data_inicio: this.props.dataInicio,
            data_fim: this.props.dataFim,
            horario_inicio: this.props.horarioInicio ?? null,
            horario_fim: this.props.horarioFim ?? null,
            tipo_prazo: this.props.tipoPrazo ?? 'periodo',
            recorrencia: this.props.recorrencia ?? null,
            capacidade: this.props.capacidade ?? null,
            bairros: JSON.stringify(this.props.bairros ?? []),
            local: this.props.local ?? null,
            vagas_ocupadas: this.props.vagasOcupadas,
            status: this.props.status,
            abertura_em: this.props.aberturaEm ?? null,
            criado_por: this.props.criadoPor,
            criado_em: this.props.criadoEm,
            atualizado_em: this.props.atualizadoEm,
        };
    }
}
