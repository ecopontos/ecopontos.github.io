export interface DataRegistryDto {
    id: string;
    tipo: string;
    conteudo: unknown;
    criadoEm?: string;
    atualizadoEm?: string;
}

export interface CreateDataRegistryInput {
    tipo: string;
    conteudo: unknown;
}
