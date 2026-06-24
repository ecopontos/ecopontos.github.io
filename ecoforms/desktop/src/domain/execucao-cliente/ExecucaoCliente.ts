export interface ExecucaoClienteProps {
    id: string;
    execucaoId: string;
    clienteId: string;
    coletaRealizada: boolean;
    ocorrencia: string | null;
    observacao: string | null;
    horarioVisita: string | null;
    latitude: number | null;
    longitude: number | null;
    registradoPor: string | null;
    registradoEm: string;
}

export class ExecucaoCliente {
    private constructor(private readonly props: ExecucaoClienteProps) {}

    static fromProps(props: ExecucaoClienteProps): ExecucaoCliente {
        return new ExecucaoCliente(props);
    }

    static fromRow(row: {
        id: string;
        execucao_id: string;
        cliente_id: string;
        coleta_realizada: number;
        ocorrencia: string | null;
        observacao: string | null;
        horario_visita: string | null;
        latitude: number | null;
        longitude: number | null;
        registrado_por: string | null;
        registrado_em: string;
    }): ExecucaoCliente {
        return new ExecucaoCliente({
            id: row.id,
            execucaoId: row.execucao_id,
            clienteId: row.cliente_id,
            coletaRealizada: row.coleta_realizada === 1,
            ocorrencia: row.ocorrencia,
            observacao: row.observacao,
            horarioVisita: row.horario_visita,
            latitude: row.latitude,
            longitude: row.longitude,
            registradoPor: row.registrado_por,
            registradoEm: row.registrado_em,
        });
    }

    get id(): string { return this.props.id; }
    get execucaoId(): string { return this.props.execucaoId; }
    get clienteId(): string { return this.props.clienteId; }
    get coletaRealizada(): boolean { return this.props.coletaRealizada; }
    get ocorrencia(): string | null { return this.props.ocorrencia; }
    get observacao(): string | null { return this.props.observacao; }
    get horarioVisita(): string | null { return this.props.horarioVisita; }
    get latitude(): number | null { return this.props.latitude; }
    get longitude(): number | null { return this.props.longitude; }
    get registradoPor(): string | null { return this.props.registradoPor; }
    get registradoEm(): string { return this.props.registradoEm; }

    toRow(): {
        id: string;
        execucao_id: string;
        cliente_id: string;
        coleta_realizada: number;
        ocorrencia: string | null;
        observacao: string | null;
        horario_visita: string | null;
        latitude: number | null;
        longitude: number | null;
        registrado_por: string | null;
        registrado_em: string;
    } {
        return {
            id: this.props.id,
            execucao_id: this.props.execucaoId,
            cliente_id: this.props.clienteId,
            coleta_realizada: this.props.coletaRealizada ? 1 : 0,
            ocorrencia: this.props.ocorrencia,
            observacao: this.props.observacao,
            horario_visita: this.props.horarioVisita,
            latitude: this.props.latitude,
            longitude: this.props.longitude,
            registrado_por: this.props.registradoPor,
            registrado_em: this.props.registradoEm,
        };
    }
}
