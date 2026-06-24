import type { UserRepository } from '../../domain/user/UserRepository';
import { NotFoundError } from '../../domain/shared/errors';
import type { UserDto } from './dto/UserDto';
import { toUserDto } from './mappers';

export class ToggleUserStatusUseCase {
    constructor(private readonly repo: UserRepository) {}

    async execute(id: string): Promise<UserDto> {
        const user = await this.repo.findById(id);
        if (!user) throw new NotFoundError('User', id);
        user.toggleActive();
        await this.repo.save(user);
        return toUserDto(user);
    }
}
