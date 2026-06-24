import type { HierarquiaPerfil } from './HierarquiaPerfil';

export interface HierarquiaPerfilRepository {
    findAll(): Promise<HierarquiaPerfil[]>;
    findByPerfil(perfil: string): Promise<HierarquiaPerfil | null>;
    findByNivel(nivel: number): Promise<HierarquiaPerfil[]>;
    save(hierarquia: HierarquiaPerfil): Promise<void>;
    delete(perfil: string): Promise<void>;
}
