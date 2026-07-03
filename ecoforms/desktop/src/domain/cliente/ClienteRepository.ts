/**
 * Domain interface for unified Cliente repository (Onda 2 — SDD)
 * Replaces legacy ClientRepository
 */
import type { Cliente, ClienteContato, ClienteFilter, ClienteImovelVinculoWithDetails, ClientePjVinculo, ConfiancaVinculo, ImovelDisponivel, OrigemVinculo, TipoRelacaoVinculo, VinculoSuggestion } from '../../../types/clientes';

export interface ClienteRepository {
    findAll(filter?: ClienteFilter): Promise<Cliente[]>;
    findByTelefone(telefone: string): Promise<Cliente[]>;
    findById(id: string): Promise<Cliente | null>;
    findByDocumento(documento: string): Promise<Cliente | null>;
    findContatos(clienteId: string): Promise<ClienteContato[]>;
    findPfByPjId(pjId: string): Promise<Cliente[]>;
    findPjByPfId(pfId: string): Promise<(ClientePjVinculo & { pj_nome: string; pj_documento?: string | null; pj_cidade?: string | null; pj_estado?: string | null })[]>;
    findPfUnassigned(): Promise<Cliente[]>;
    findPjUnassignedToPf(pfId: string): Promise<Cliente[]>;
    linkPfToPj(pfId: string, pjId: string, funcao?: string | null): Promise<void>;
    unlinkPfFromPj(pfId: string, pjId: string): Promise<void>;
    updateVinculoFuncao(vinculoId: string, funcao: string): Promise<void>;
    // ── Fase 3: vínculo N:N cliente↔imóvel (terreno) ──
    findImoveisByClienteId(clienteId: string): Promise<ClienteImovelVinculoWithDetails[]>;
    findImoveisDisponiveis(clienteId: string, search?: string): Promise<ImovelDisponivel[]>;
    linkClienteToImovel(
        clienteId: string,
        imovelId: string,
        tipo_relacao?: TipoRelacaoVinculo | null,
        principal?: boolean,
        confianca?: ConfiancaVinculo | null,
        origem?: OrigemVinculo | null,
    ): Promise<void>;
    unlinkClienteFromImovel(vinculoId: string): Promise<void>;
    updateVinculoImovel(vinculoId: string, update: { tipo_relacao?: TipoRelacaoVinculo | null; principal?: boolean; confianca?: ConfiancaVinculo | null }): Promise<void>;
    suggestImoveisForCliente(clienteId: string): Promise<VinculoSuggestion[]>;
    save(cliente: Cliente): Promise<void>;
    saveContato(contato: ClienteContato): Promise<void>;
    deleteContato(contatoId: string): Promise<void>;
    delete(id: string): Promise<void>;
    nameExists(nome: string, excludeId?: string): Promise<boolean>;
    documentoExists(documento: string, excludeId?: string): Promise<boolean>;
}
