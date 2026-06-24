export interface UserDto {
    id: string;
    nome: string;
    username: string;
    email?: string;
    perfil: string;
    ativo: boolean;
    setores: string[];
    criadoEm?: string;
    atualizadoEm?: string;
}

export interface CreateUserInput {
    nome: string;
    username: string;
    email?: string;
    perfil: string;
    passwordHash: string;
    setores?: string[];
}

export interface UpdateUserInput {
    id: string;
    nome?: string;
    username?: string;
    email?: string;
    perfil?: string;
    ativo?: boolean;
    setores?: string[];
}
