import type { SqlitePort } from '../ports/SqlitePort';

export interface AccessMatrixEntry {
    moduleSlug: string;
    allowed: boolean;
}

export class GetUserAccessMatrixUseCase {
    constructor(private readonly sqlite: SqlitePort) {}

    async execute(userId: string): Promise<AccessMatrixEntry[]> {
        const rows = await this.sqlite.query<{ module_slug: string; allowed: number }>(
            `SELECT module_slug, allowed FROM tbl_module_permission_overrides WHERE user_id = ?`,
            [userId],
        );
        return rows.map(r => ({ moduleSlug: r.module_slug, allowed: r.allowed === 1 }));
    }
}
