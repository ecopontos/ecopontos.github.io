import type { SqlitePort } from '../ports/SqlitePort';

export class SetModulePermissionOverrideUseCase {
    constructor(private readonly sqlite: SqlitePort) {}

    async execute(moduleSlug: string, userId: string, allowed: boolean): Promise<void> {
        await this.sqlite.execute(
            `INSERT OR REPLACE INTO tbl_module_permission_overrides (module_slug, user_id, allowed) VALUES (?, ?, ?)`,
            [moduleSlug, userId, allowed ? 1 : 0],
        );
    }
}
