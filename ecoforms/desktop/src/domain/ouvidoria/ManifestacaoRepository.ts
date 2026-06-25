/**
 * Domain interface for Manifestacao repository (Onda 3 — SDD)
 */

export interface ManifestacaoSummary {
    id: string;
    protocolo: string;
    tipoNome: string;
    origemNome: string;
    classificacaoNome: string;
    situacaoNome: string;
    solicitanteNome: string;
    solicitanteEmail?: string;
    solicitanteTelefone?: string;
    assunto: string;
    descricao?: string;
    status: string;
    prioridade: string;
    responsavelId?: string;
    responsavelNome?: string;
    setorId?: string;
    setorNome?: string;
    clienteNome?: string;
    criadoEm: string;
    atualizadoEm?: string;
    prazoLimite?: string;
    anonimo?: number;
    sigiloso?: number;
    atribuidoEm?: string;
    aceiteEm?: string;
    avaliacaoSatisfacao?: number;
    manifestacaoOrigemId?: string;
    competencia?: 'compete' | 'nao_compete' | 'pendente';
    motivoIncompetencia?: string;
    orgaoDestino?: string;
    dataCompetencia?: string;
    subassuntoId?: string;
    subunidadeId?: string;
    programaOrcamentarioId?: string;
}

export type TipoTramitacao = 'encaminhamento' | 'transferencia' | 'devolucao' | 'cobranca';

export interface Tramitacao {
    id: string;
    manifestacaoId: string;
    deSetorId?: string | null;
    paraSetorId: string;
    deSetorNome?: string | null;  // preenchido apenas em leituras (JOIN)
    paraSetorNome?: string | null; // preenchido apenas em leituras (JOIN)
    observacao?: string;
    usuarioId: string;
    usuarioNome?: string | null;  // preenchido apenas em leituras (JOIN)
    tipoTramitacao?: TipoTramitacao;
    criadoEm: string;
}

export interface Resposta {
    id: string;
    manifestacaoId: string;
    texto: string;
    enviadaPorId: string;       // FK usuarios.id — usado em INSERT
    enviadaPor?: string | null; // nome — preenchido apenas em leituras (JOIN)
    enviadaEm: string;
    respostaFormatada?: string | null;
    modeloId?: string | null;
    revisadaPor?: string | null;  // nome — preenchido em leituras (JOIN)
    revisadaPorId?: string | null; // FK — usado em INSERT
    dataRevisao?: string | null;
}

export interface ModeloResposta {
    id: string;
    tipoManifestacaoId: string;
    assuntoId?: string | null;
    titulo: string;
    corpo: string;
}

export type CanalEnvio = 'email' | 'whatsapp' | 'portal' | 'impresso';
export type StatusEnvio = 'pendente' | 'enviado' | 'falha';

export interface EnvioResposta {
    id: string;
    respostaId: string;
    manifestacaoId: string;
    canal: CanalEnvio;
    destinatario?: string | null;
    statusEnvio: StatusEnvio;
    dataEnvio?: string | null;
    erro?: string | null;
}

export interface Despacho {
    id: string;
    manifestacaoId: string;
    texto: string;
    despachadoPorId: string;       // FK usuarios.id — usado em INSERT
    despachadoPor?: string | null; // nome — preenchido apenas em leituras (JOIN)
    despachadoEm: string;
}

export interface Anexo {
    id: string;
    manifestacaoId: string;
    nomeArquivo: string;    // coluna: nome_arquivo
    storagePath?: string;  // coluna: storage_path
    mimeType?: string;     // coluna: mime_type
    criadoEm: string;      // coluna: created_at (tabela anexos usa created_at, não criado_em)
}

export interface Prazo {
    id: string;
    manifestacaoId: string;
    tipoPrazo: string;
    dataLimite: string;
    status: string;
    cumpridoEm?: string;
    criadoEm: string;
}

export interface Notificacao {
    id: string;
    usuarioId: string;
    manifestacaoId?: string;
    mensagem: string;
    lida: boolean;
    criadoEm: string;
    lidaEm?: string;
}

export interface HistoricoAlteracao {
    id: string;
    manifestacaoId: string;
    campo: string;
    valorAnterior?: string;
    valorNovo?: string;
    alteradoPor: string;
    alteradoEm: string;
}

export interface ManifestacaoFilter {
    status?: string;
    tipoId?: string;
    origemId?: string;
    classificacaoId?: string;
    situacaoId?: string;
    responsavelId?: string;
    setorId?: string;
    clienteId?: string;
    searchTerm?: string;
    dataInicio?: string;
    dataFim?: string;
}

export interface ManifestacaoInput {
    id: string;
    protocolo?: string;
    tipo_id: string;
    origem_id: string;
    classificacao_id: string;
    situacao_id: string;
    assunto: string;
    descricao: string;
    prioridade?: string;
    status?: string;
    solicitante_nome?: string;
    solicitante_email?: string;
    solicitante_telefone?: string;
    obs_solicitante?: string;
    cliente_id?: string | null;
    responsavel_id?: string | null;
    setor_id?: string | null;
    anonimo?: number;
    sigiloso?: number;
    prazo_limite?: string | null;
    cancelamento_motivo?: string | null;
    subassunto_id?: string | null;
    subunidade_id?: string | null;
    programa_orcamentario_id?: string | null;
    atribuido_em?: string | null;
    aceite_em?: string | null;
    avaliacao_satisfacao?: number | null;
    avaliacao_comentario?: string | null;
    avaliacao_em?: string | null;
    manifestacao_origem_id?: string | null;
    encerrado_em?: string | null;
}

export interface ManifestacaoRepository {
    findAll(filter?: ManifestacaoFilter): Promise<ManifestacaoSummary[]>;
    findById(id: string): Promise<ManifestacaoSummary | null>;
    findByProtocolo(protocolo: string): Promise<ManifestacaoSummary | null>;
    save(manifestacao: ManifestacaoInput): Promise<void>;
    updateStatus(id: string, status: string, responsavelId?: string): Promise<void>;
    verificarCompetencia(id: string, competencia: 'compete' | 'nao_compete', motivo?: string, orgaoDestino?: string): Promise<void>;
    classificar(id: string, data: { subassuntoId?: string; subunidadeId?: string; programaOrcamentarioId?: string }): Promise<void>;
    formatarResposta(manifestacaoId: string, data: { respostaId: string; respostaFormatada: string; modeloId?: string; revisadaPorId: string; marcarRespondida: boolean }): Promise<void>;
    listModelosResposta(tipoId?: string, assuntoId?: string): Promise<ModeloResposta[]>;
    aceitarManifestacao(id: string): Promise<void>; // ADR-013 §2.1 — aceite explícito pelo responsável
    delete(id: string): Promise<void>;

    // Envio ao cidadão
    listEnvios(manifestacaoId: string): Promise<EnvioResposta[]>;
    registrarEnvio(e: EnvioResposta): Promise<void>;

    // Workflow
    listTramitacoes(manifestacaoId: string): Promise<Tramitacao[]>;
    addTramitacao(t: Tramitacao): Promise<void>;

    listRespostas(manifestacaoId: string): Promise<Resposta[]>;
    addResposta(r: Resposta): Promise<void>;

    listDespachos(manifestacaoId: string): Promise<Despacho[]>;
    addDespacho(d: Despacho): Promise<void>;

    listAnexos(manifestacaoId: string): Promise<Anexo[]>;
    addAnexo(a: Anexo): Promise<void>;
    removeAnexo(anexoId: string): Promise<void>;

    listPrazos(manifestacaoId: string): Promise<Prazo[]>;
    addPrazo(p: Prazo): Promise<void>;
    updatePrazoStatus(prazoId: string, status: string, cumpridoEm?: string): Promise<void>;

    listNotificacoes(usuarioId: string, apenasNaoLidas?: boolean): Promise<Notificacao[]>;
    marcarNotificacaoLida(notificacaoId: string): Promise<void>;
    addNotificacao(n: Notificacao): Promise<void>;

    listHistorico(manifestacaoId: string): Promise<HistoricoAlteracao[]>;
    addHistorico(h: HistoricoAlteracao): Promise<void>;
}
