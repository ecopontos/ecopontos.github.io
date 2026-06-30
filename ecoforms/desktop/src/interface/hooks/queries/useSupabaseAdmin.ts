import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAuth } from '@/contexts/AuthContext';
import { useContainer } from '../utils/useContainer';
import type { ProfileSyncResult } from '@/src/infrastructure/sync/SupabaseUserSyncService';
export type { ProfileSyncResult };

interface AdminResponse {
    success: boolean;
    message: string;
    data?: unknown;
}

export function useSupabaseAdmin() {
    const { user } = useAuth();
    const container = useContainer();
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
            const response = await callAdmin('read_profiles', {}, 'perfis');
            if (!response.success) throw new Error(response.message);
            const profiles = (Array.isArray(response.data) ? response.data : []) as Parameters<typeof container.userProfileSync.syncFromSupabase>[0];
            if (!profiles.length) return { synced: 0, created: 0, updated: 0, skipped: 0, errors: [] };
            return await container.userProfileSync.syncFromSupabase(profiles);
        } finally {
            setSyncing(false);
        }
    }, [callAdmin, container]);

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
