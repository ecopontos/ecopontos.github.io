import type { SqliteUserRepository } from '../persistence/sqlite/SqliteUserRepository';
import type { SqlitePort } from '../../application/ports/SqlitePort';
import { User } from '../../domain/user/User';
import { uuidv7 } from 'ecoforms-core';

interface ProfileRow {
    id: string;
    nome: string;
    email: string;
    perfil: string;
    ativo: boolean;
    org_id: string;
}

export interface ProfileSyncResult {
    synced: number;
    created: number;
    updated: number;
    skipped: number;
    errors: string[];
}

export class SupabaseUserSyncService {
    constructor(
        private userRepo: SqliteUserRepository,
        private sqlite: SqlitePort
    ) {}

    async syncFromSupabase(profiles: ProfileRow[]): Promise<ProfileSyncResult> {
        const result: ProfileSyncResult = {
            synced: 0,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: [],
        };

        for (const profile of profiles) {
            try {
                const existing = await this.findLocalBySupabaseId(profile.id);

                if (!existing) {
                    const newUser = this.profileToUser(profile);
                    await this.userRepo.save(newUser);
                    await this.linkSupabaseId(newUser.id, profile.id);
                    result.created++;
                } else {
                    const updated = this.applyProfileUpdates(existing, profile);
                    await this.userRepo.save(updated);
                    result.updated++;
                }
                result.synced++;
            } catch (err) {
                result.errors.push(`${profile.email}: ${String(err)}`);
            }
        }

        return result;
    }

    async syncDeactivated(activeSupabaseIds: string[]): Promise<number> {
        const localUsers = await this.userRepo.findAll();
        let deactivated = 0;

        for (const user of localUsers) {
            if (!user.ativo) continue;

            const supabaseId = await this.getSupabaseId(user.id);
            if (!supabaseId) continue;

            if (!activeSupabaseIds.includes(supabaseId)) {
                await this.userRepo.delete(user.id);
                deactivated++;
            }
        }

        return deactivated;
    }

    private profileToUser(profile: ProfileRow): User {
        const localId = uuidv7();

        return User.fromProps({
            id: localId,
            nome: profile.nome,
            username: profile.email.split('@')[0],
            email: profile.email,
            perfil: profile.perfil,
            ativo: profile.ativo,
            setores: [],
        });
    }

    private applyProfileUpdates(user: User, profile: ProfileRow): User {
        const updated = User.fromProps(user.toProps());
        updated.update({
            nome: profile.nome,
            email: profile.email,
            perfil: profile.perfil,
        });
        return updated;
    }

    private async findLocalBySupabaseId(supabaseId: string): Promise<User | null> {
        const rows = await this.sqlite.query<{ local_id: string }>(
            `SELECT local_id FROM mapeamento_usuarios_supabase WHERE supabase_id = ? LIMIT 1`,
            [supabaseId],
        );
        if (!rows[0]) return null;
        return this.userRepo.findById(rows[0].local_id);
    }

    private async linkSupabaseId(localId: string, supabaseId: string): Promise<void> {
        await this.sqlite.execute(
            `INSERT OR IGNORE INTO mapeamento_usuarios_supabase (local_id, supabase_id) VALUES (?, ?)`,
            [localId, supabaseId],
        );
    }

    private async getSupabaseId(localId: string): Promise<string | null> {
        const rows = await this.sqlite.query<{ supabase_id: string }>(
            `SELECT supabase_id FROM mapeamento_usuarios_supabase WHERE local_id = ? LIMIT 1`,
            [localId],
        );
        return rows[0]?.supabase_id ?? null;
    }
}
