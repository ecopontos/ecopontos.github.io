import { User } from '../../domain/user/User';
import type { UserRepository } from '../../domain/user/UserRepository';
import type { CreateUserInput, UserDto } from './dto/UserDto';
import { toUserDto } from './mappers';
import { uuidv7 } from 'ecoforms-core';
import { isKnownPerfil, canAssignProfile } from '../../domain/access/AccessPolicy';
import { ValidationError, ForbiddenError } from '../../domain/shared/errors';

export class CreateUserUseCase {
    constructor(private readonly repo: UserRepository) {}

    async execute(input: CreateUserInput, actorPerfil: string): Promise<UserDto> {
        if (!isKnownPerfil(input.perfil)) {
            throw new ValidationError(`Perfil inválido: ${input.perfil}`);
        }
        if (!canAssignProfile(actorPerfil, input.perfil)) {
            throw new ForbiddenError(
                `Perfil '${actorPerfil}' não pode atribuir perfil '${input.perfil}'`,
            );
        }
        const now = new Date().toISOString();
        const user = User.fromProps({
            id: uuidv7(),
            nome: input.nome,
            username: input.username,
            email: input.email,
            perfil: input.perfil,
            ativo: true,
            passwordHash: input.passwordHash || undefined,
            setores: input.setores ?? [],
            criadoEm: now,
            atualizadoEm: now,
        });
        await this.repo.save(user);
        if (input.setores?.length) {
            await this.repo.assignSectors(user.id, input.setores);
        }
        return toUserDto(user);
    }
}
