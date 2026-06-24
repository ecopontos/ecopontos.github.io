import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/src/infrastructure/persistence/supabase/supabaseClient';
import type { ProfileSyncResult } from '@/src/infrastructure/sync/SupabaseUserSyncService';

interface AdminResponse {
    success: boolean;
    message: string;
    data?: unknown;
}

export function useSupabaseAdmin() {
    const { user } = useAuth();
    const [syncing, setSyncing] = useState(false);

    const callAdmin = useCallback(async (
        operation: string,
        payload: Record<string, unknown> = {},
        table = 'usuarios',
    ): Promise<AdminResponse> => {
        if (!user) throw new Error('Not authenticated');
        return invoke<AdminResponse>('supabase_admin_query', {
            request: { table, operation, user_id: user.id, payload },
        });
    }, [user]);

    const syncFromSupabase = useCallback(async (): Promise<ProfileSyncResult> => {
        setSyncing(true);
        try {
            const { data: profiles, error } = await supabase
                .from('profiles')
                .select('id, nome, email, perfil, ativo, org_id');

            if (error) throw new Error(error.message);
            if (!profiles?.length) return { synced: 0, created: 0, updated: 0, skipped: 0, errors: [] };

            const { getContainer } = await import('@/src/infrastructure/container');
            const { SqliteUserRepository } = await import('@/src/infrastructure/persistence/sqlite/SqliteUserRepository');
            const { SupabaseUserSyncService } = await import('@/src/infrastructure/sync/SupabaseUserSyncService');

            const container = getContainer();
            const userRepo = new SqliteUserRepository(container.sqlite);
            const syncService = new SupabaseUserSyncService(userRepo, container.sqlite);
            return await syncService.syncFromSupabase(profiles);
        } finally {
            setSyncing(false);
        }
    }, []);

    const readUsers = useCallback(
        () => callAdmin('read_users', {}),
        [callAdmin],
    );

    const createSupabaseUser = useCallback(
        (email: string, password: string, metadata: Record<string, unknown>) =>
            callAdmin('create_user', { email, password, user_metadata: metadata }),
        [callAdmin],
    );

    const updateSupabaseUser = useCallback(
        (supabaseId: string, metadata: Record<string, unknown>) =>
            callAdmin('update_user', { supabase_id: supabaseId, user_metadata: metadata }),
        [callAdmin],
    );

    const deleteSupabaseUser = useCallback(
        (supabaseId: string) =>
            callAdmin('delete_user', { supabase_id: supabaseId }),
        [callAdmin],
    );

    return {
        syncing,
        syncFromSupabase,
        readUsers,
        createSupabaseUser,
        updateSupabaseUser,
        deleteSupabaseUser,
    };
}
