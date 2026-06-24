/**
 * Domain interface for Logistics repository (Onda 4 — SDD)
 */

export interface Roteiro {
    id: string;
    nome: string;
    descricao?: string | null;
    tipoResiduo?: string | null;
    periodicidade?: string | null;
    turno?: string | null;
    base?: string | null;
    distrito?: string | null;
    situacao: string;
    criadoPor: string;
    criadoEm: string;
    atualizadoEm: string;
}

export interface RoteiroCliente {
    id: string;
    roteiroId: string;
    clienteId: string;
    ordem: number;
    observacao?: string | null;
    ativo: number;
    criadoEm: string;
    clienteNome?: string | null;
}

export interface ExecucaoColeta {
    id: string;
    roteiroId: string;
    dataExecucao: string;
    status: string;
    motoristaId?: string | null;
    ajudanteId?: string | null;
    veiculo?: string | null;
    kmInicial?: number | null;
    kmFinal?: number | null;
    observacoes?: string | null;
    inicioEm?: string | null;
    fimEm?: string | null;
    criadoEm: string;
    idDespacho?: number | null;
    codigoDespacho?: string | null;
    pesoTotal?: number | null;
    volumeTotal?: number | null;
    numeroViagens?: number | null;
    roteiroNome?: string | null;
    motoristaNome?: string | null;
    ajudanteNome?: string | null;
}

/**
 * Pesagem externa (comcap.cad_balanca) — 1 linha por viagem/pesagem
 * vinculada a um despacho, sincronizada do PostgreSQL externo.
 */
export interface ExecucaoPesagem {
    id: string;
    execucaoId: string;
    idBalanca?: number | null;
    idDespacho?: number | null;
    codigoDespacho?: string | null;
    dataPesagem?: string | null;
    veiculo?: string | null;
    residuo?: string | null;
    origem?: string | null;
    destino?: string | null;
    tipoColeta?: string | null;
    pesoLiquido?: number | null;
    situacao?: number | null;
    statusDespacho?: string | null;
    criadoEm: string;
}

export interface ExecucaoHistorico {
    id: string;
    execucaoId: string;
    statusAnterior: string | null;
    statusNovo: string;
    alteradoPor: string;
    alteradoPorNome?: string | null;
    alteradoEm: string;
    observacao?: string | null;
}

export interface ChecklistExecucao {
    id: string;
    execucaoId: string;
    item: string;
    concluido: number;
    observacao?: string | null;
    evidenciaUrl?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    concluidoEm?: string | null;
    concluidoPor?: string | null;
    concluidoPorNome?: string | null;
}

export interface Intercorrencia {
    id: string;
    execucaoId: string;
    tipoOcorrenciaId: string;
    tipoOcorrenciaNome?: string | null;
    tipoResiduoId?: string | null;
    quantidade?: number | null;
    descricao?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    endereco?: string | null;
    resolvido: number;
    resolvidoEm?: string | null;
    resolvidoPor?: string | null;
    resolvidoPorNome?: string | null;
    resolvidoComo?: string | null;
    observacao?: string | null;
    registradoPor: string;
    registradoPorNome?: string | null;
    registradoEm: string;
    atualizadoEm: string;
}

export interface ExecucaoCliente {
    id: string;
    execucaoId: string;
    clienteId: string;
    coletaRealizada: number;
    quantidade?: number | null;
    ocorrencia?: string | null;
    observacao?: string | null;
    horarioVisita?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    registradoPor: string;
    registradoEm: string;
    clienteNome?: string | null;
}

export interface RoteiroFilter {
    situacao?: string;
    searchTerm?: string;
}

export interface ExecucaoFilter {
    roteiroId?: string;
    status?: string;
    dataInicio?: string;
    dataFim?: string;
    motoristaId?: string;
}

export interface LogisticsRepository {
    // Roteiros
    findAllRoteiros(filter?: RoteiroFilter): Promise<Roteiro[]>;
    findRoteiroById(id: string): Promise<Roteiro | null>;
    saveRoteiro(roteiro: Roteiro): Promise<void>;
    deleteRoteiro(id: string): Promise<void>;

    // Roteiro Clientes
    findClientesByRoteiro(roteiroId: string): Promise<RoteiroCliente[]>;
    addClienteToRoteiro(rc: RoteiroCliente): Promise<void>;
    removeClienteFromRoteiro(roteiroId: string, clienteId: string): Promise<void>;
    updateClienteOrdem(roteiroId: string, clienteId: string, ordem: number): Promise<void>;

    // Execucao Coleta
    findAllExecucoes(filter?: ExecucaoFilter): Promise<ExecucaoColeta[]>;
    findExecucaoById(id: string): Promise<ExecucaoColeta | null>;
    saveExecucao(exec: ExecucaoColeta): Promise<void>;
    updateExecucaoStatus(id: string, status: string, fimEm?: string, alteradoPor?: string, observacao?: string): Promise<void>;
    deleteExecucao(id: string): Promise<void>;

    // Histórico de status da execução
    findHistoricoByExecucao(execucaoId: string): Promise<ExecucaoHistorico[]>;

    // Intercorrências
    findIntercorrenciasByExecucao(execucaoId: string): Promise<Intercorrencia[]>;
    saveIntercorrencia(item: Intercorrencia): Promise<void>;
    resolverIntercorrencia(id: string, resolvidoPor: string, resolvidoComo: string): Promise<void>;

    // Checklist
    findChecklistByExecucao(execucaoId: string): Promise<ChecklistExecucao[]>;
    saveChecklistItem(item: ChecklistExecucao): Promise<void>;
    completeChecklistItem(
        id: string,
        concluidoPor: string,
        observacao?: string,
        evidenciaUrl?: string,
        latitude?: number,
        longitude?: number
    ): Promise<void>;

    // Execucao Clientes (retorno do checklist)
    findExecucaoClientes(execucaoId: string): Promise<ExecucaoCliente[]>;
    saveExecucaoCliente(item: ExecucaoCliente): Promise<void>;

    // Pesagens (despacho/balança externos)
    findPesagensByExecucao(execucaoId: string): Promise<ExecucaoPesagem[]>;
}
