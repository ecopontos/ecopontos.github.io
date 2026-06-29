import type { SupabaseAdminPort } from '../../application/ports/SupabaseAdminPort';

export class FakeSupabaseAdmin implements SupabaseAdminPort {
    public deletedProfiles: string[] = [];
    public deletedAuthUsers: string[] = [];

    async deleteProfile(supabaseId: string): Promise<void> {
        this.deletedProfiles.push(supabaseId);
    }

    async deleteAuthUser(supabaseId: string): Promise<void> {
        this.deletedAuthUsers.push(supabaseId);
    }
}
