import type { UserRepository } from '../../domain/user/UserRepository';
import type { UserDto } from './dto/UserDto';
import { toUserDto } from './mappers';

export class ListUsersUseCase {
    constructor(private readonly repo: UserRepository) {}

    async execute(): Promise<UserDto[]> {
        const users = await this.repo.findAll();
        return users.map(toUserDto);
    }
}

export { CreateUserUseCase } from './CreateUserUseCase';
export { UpdateUserUseCase } from './UpdateUserUseCase';
export { ToggleUserStatusUseCase } from './ToggleUserStatusUseCase';
