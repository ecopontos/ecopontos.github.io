import { useCallback } from 'react';
import { getUiSupabaseClient } from '../utils/useSupabaseClient';
import { useTauriInvoke } from '@/src/interface/hooks/catalog/tauri';
import { useContainerAsync } from '@/src/interface/hooks/catalog/utils';

export interface UserSummary {
    id: string;
    nome: string;
    username: string;
    perfil: string;
    setor?: string;
}

export type UserSource = 'seed' | 'lan';

export function useFirstRunSetup() {
    const invoke = useTauriInvoke();
    const getContainer = useContainerAsync();

    const saveLanPath = useCallback(async (path: string) => {
        try {
            await invoke('bootstrap_set_lan_sync_path', { path: path.trim() });
        } catch (error: unknown) {
            if (!String(error).includes('no such table')) {
                throw error;
            }

            console.warn('[FirstRun] Table missing, retrying after ensureColumnsIfNeeded...');
            await new Promise((resolve) => setTimeout(resolve, 500));
            await invoke('bootstrap_set_lan_sync_path', { path: path.trim() });
        }
    }, [invoke]);

    const loadUsers = useCallback(async (): Promise<{ users: UserSummary[]; source: UserSource | null }> => {
        try {
            const container = await getContainer();
            const lan = container.lanFileStorage;
            const seed = await lan.readExpectedUsersSeed();

            if (seed?.users?.length) {
                const imported = await invoke<UserSummary[]>('bootstrap_import_seed_users', {
                    users: seed.users,
                });
                return { users: imported, source: imported.length ? 'seed' : null };
            }

            const lanUsers = await lan.listUsersFromLan();
            return { users: lanUsers, source: lanUsers.length ? 'lan' : null };
        } catch (error) {
            console.warn('[FirstRun] Failed to load users from LAN:', error);
            return { users: [], source: null };
        }
    }, [getContainer, invoke]);

    const testLanConnection = useCallback(async () => {
        const container = await getContainer();
        return container.lanFileStorage.testConnection();
    }, [getContainer]);

    const mirrorAdminToSupabase = useCallback(async (
        nome: string,
        username: string,
        password: string,
    ): Promise<void> => {
        if (!navigator.onLine) {
            return;
        }

        try {
            const client = getUiSupabaseClient();
            const email = `${username}@ecoforms.local`;
            const { error } = await client.auth.signUp({
                email,
                password,
                options: {
                    data: { nome, perfil: 'admin', org_id: 'ecoforms-org-001' },
                },
            });

            if (error) {
                console.warn('[FirstRun] Supabase Auth signUp:', error.message);
            }
        } catch (error) {
            console.warn('[FirstRun] Supabase Auth indisponível (non-fatal):', error);
        }
    }, []);

    return {
        saveLanPath,
        loadUsers,
        testLanConnection,
        mirrorAdminToSupabase,
    };
}
