import type { ProfileSyncResult } from './SupabaseUserSyncService';
import { SupabaseUserSyncService } from './SupabaseUserSyncService';
import { SqliteUserRepository } from '../persistence/sqlite/SqliteUserRepository';
import type { SqlitePort } from '../../application/ports/SqlitePort';

interface RemoteProfileRow {
    id: string;
    nome: string;
    email: string;
    perfil: string;
    ativo: boolean;
    org_id: string;
}

export class RemoteUserProfileSync {
    constructor(private readonly sqlite: SqlitePort) {}

    async syncFromSupabase(profiles: RemoteProfileRow[]): Promise<ProfileSyncResult> {
        const userRepo = new SqliteUserRepository(this.sqlite);
        const syncService = new SupabaseUserSyncService(userRepo, this.sqlite);
        return syncService.syncFromSupabase(profiles);
    }
}
