import type { User } from './User';

export interface UserRepository {
    findAll(): Promise<User[]>;
    findById(id: string): Promise<User | null>;
    save(user: User): Promise<void>;
    delete(id: string): Promise<void>;
    assignSectors(userId: string, setores: string[]): Promise<void>;
}
