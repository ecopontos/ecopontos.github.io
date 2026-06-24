export interface Ecoponto {
    id: string;
    nome: string;
    endereco?: string | null;
    setorId?: string | null;
    ativo: number;
    criadoEm?: string | null;
    atualizadoEm?: string | null;
}
