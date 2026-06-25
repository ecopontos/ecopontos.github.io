import type { User } from '../../domain/user/User';
import type { UserDto } from './dto/UserDto';

export function toUserDto(user: User): UserDto {
    const p = user.toProps();
    return {
        id: p.id,
        nome: p.nome,
        username: p.username,
        email: p.email,
        perfil: p.perfil,
        ativo: p.ativo,
        setores: p.setores,
        criadoEm: p.criadoEm,
        atualizadoEm: p.atualizadoEm,
    };
}
