import type { UserRepository } from '../../domain/user/UserRepository';
import { NotFoundError, ValidationError, ForbiddenError } from '../../domain/shared/errors';
import type { UpdateUserInput, UserDto } from './dto/UserDto';
import { toUserDto } from './mappers';
import { isKnownPerfil, canAssignProfile } from '../../domain/access/AccessPolicy';

export class UpdateUserUseCase {
    constructor(private readonly repo: UserRepository) {}

    async execute(input: UpdateUserInput, actorPerfil: string): Promise<UserDto> {
        const user = await this.repo.findById(input.id);
        if (!user) throw new NotFoundError('User', input.id);

        if (input.perfil !== undefined) {
            if (!isKnownPerfil(input.perfil)) {
                throw new ValidationError(`Perfil inválido: ${input.perfil}`);
            }
            if (!canAssignProfile(actorPerfil, input.perfil)) {
                throw new ForbiddenError(
                    `Perfil '${actorPerfil}' não pode atribuir perfil '${input.perfil}'`,
                );
            }
        }
        user.update({
            nome: input.nome,
            username: input.username,
            email: input.email,
            perfil: input.perfil,
            ativo: input.ativo,
            passwordHash: input.passwordHash,
            setores: input.setores,
        });
        await this.repo.save(user);
        if (input.setores) {
            await this.repo.assignSectors(user.id, input.setores);
        }
        return toUserDto(user);
    }
}
