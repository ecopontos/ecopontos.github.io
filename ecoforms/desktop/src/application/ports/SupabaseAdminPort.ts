export interface SupabaseAdminPort {
    deleteProfile(supabaseId: string): Promise<void>;
    deleteAuthUser(supabaseId: string): Promise<void>;
}
