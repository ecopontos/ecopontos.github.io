import { invoke } from '@tauri-apps/api/core';
import { supabase } from '../persistence/supabase/supabaseClient';
import type { SupabaseAdminPort } from '../../application/ports/SupabaseAdminPort';

interface AdminOperationResponse {
    success: boolean;
    message: string;
    data?: unknown;
}

export class SupabaseAdminAdapter implements SupabaseAdminPort {
    async deleteProfile(supabaseId: string): Promise<void> {
        const { error } = await supabase.from('profiles').delete().eq('id', supabaseId);
        if (error) throw new Error(error.message);
    }

    async deleteAuthUser(supabaseId: string): Promise<void> {
        const resp = await invoke<AdminOperationResponse>('supabase_admin_query', {
            request: {
                table: 'usuarios',
                operation: 'delete_user',
                user_id: supabaseId,
                payload: { supabase_id: supabaseId },
            },
        });

        if (!resp.success) {
            throw new Error(resp.message);
        }
    }
}
