import { useMemo } from 'react';
import { getSupabaseClient } from '../../../infrastructure/persistence/supabase/supabaseClient';

export function useSupabaseClient() {
    return useMemo(() => getSupabaseClient(), []);
}
