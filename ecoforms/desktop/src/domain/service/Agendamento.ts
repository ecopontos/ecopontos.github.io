export type StatusAgendamento = 'pendente' | 'confirmado' | 'realizado' | 'cancelado';

const TRANSICOES: Record<StatusAgendamento, StatusAgendamento[]> = {
    pendente:   ['confirmado', 'cancelado'],
    confirmado: ['realizado', 'cancelado'],
    realizado:  [],
    cancelado:  [],
};

export function podeCancelarAgendamento(status: StatusAgendamento): boolean {
    return TRANSICOES[status]?.includes('cancelado') ?? false;
}

export interface AgendamentoProps {
    id: string;
    slotId: string;
    serviceTypeId: string;
    clienteId: string;
    clienteNome: string;
    vagasSolicitadas: number;
    bairro?: string | null;
    dadosFormulario: Record<string, unknown>;
    status: StatusAgendamento;
    taskId?: string | null;
    clienteEmail?: string | null;
    clienteTelefone?: string | null;
    responsavelId?: string | null;
    setorId?: string | null;
    criadoPor: string;
    criadoEm: string;
    atualizadoEm: string;
}

export class Agendamento {
    private constructor(private props: AgendamentoProps) {}

    static fromProps(props: AgendamentoProps): Agendamento {
        if (!props.id) throw new Error('Agendamento requer id');
        if (!props.clienteId) throw new Error('Agendamento requer clienteId');
        if (!props.slotId) throw new Error('Agendamento requer slotId');
        return new Agendamento({ ...props });
    }

    toProps(): AgendamentoProps { return { ...this.props }; }

    get id(): string { return this.props.id; }
    get slotId(): string { return this.props.slotId; }
    get serviceTypeId(): string { return this.props.serviceTypeId; }
    get clienteId(): string { return this.props.clienteId; }
    get clienteNome(): string { return this.props.clienteNome; }
    get vagasSolicitadas(): number { return this.props.vagasSolicitadas; }
    get bairro(): string | null | undefined { return this.props.bairro; }
    get dadosFormulario(): Record<string, unknown> { return this.props.dadosFormulario; }
    get status(): StatusAgendamento { return this.props.status; }
    get taskId(): string | null | undefined { return this.props.taskId; }
    get clienteEmail(): string | null | undefined { return this.props.clienteEmail; }
    get clienteTelefone(): string | null | undefined { return this.props.clienteTelefone; }
    get responsavelId(): string | null | undefined { return this.props.responsavelId; }
    get setorId(): string | null | undefined { return this.props.setorId; }
    get criadoPor(): string { return this.props.criadoPor; }
    get criadoEm(): string { return this.props.criadoEm; }

    podeTransitarPara(novoStatus: StatusAgendamento): boolean {
        return TRANSICOES[this.props.status]?.includes(novoStatus) ?? false;
    }

    transitionTo(novoStatus: StatusAgendamento): void {
        if (!this.podeTransitarPara(novoStatus)) {
            throw new Error(`Transição inválida: '${this.props.status}' → '${novoStatus}'`);
        }
        this.props.status = novoStatus;
        this.props.atualizadoEm = new Date().toISOString();
    }

    vinculaTask(taskId: string): void {
        this.props.taskId = taskId;
        this.props.atualizadoEm = new Date().toISOString();
    }

    toRow(): Record<string, unknown> {
        return {
            id:                this.props.id,
            slot_id:           this.props.slotId,
            service_type_id:   this.props.serviceTypeId,
            cliente_id:        this.props.clienteId,
            cliente_nome:      this.props.clienteNome,
            vagas_solicitadas: this.props.vagasSolicitadas,
            bairro:            this.props.bairro ?? null,
            dados_formulario:  JSON.stringify(this.props.dadosFormulario),
            status:            this.props.status,
            task_id:           this.props.taskId ?? null,
            cliente_email:     this.props.clienteEmail ?? null,
            cliente_telefone:  this.props.clienteTelefone ?? null,
            responsavel_id:    this.props.responsavelId ?? null,
            setor_id:          this.props.setorId ?? null,
            criado_por:        this.props.criadoPor,
            criado_em:         this.props.criadoEm,
            atualizado_em:     this.props.atualizadoEm,
        };
    }
}
