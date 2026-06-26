import type { SqlitePort } from '../ports/SqlitePort';

export class ListAccessibleModulesUseCase {
    constructor(private readonly sqlite: SqlitePort) {}

    async execute(userId: string, perfil: string): Promise<Array<Record<string, unknown>>> {
        return this.sqlite.query(
            `SELECT m.* FROM tbl_module_registry m WHERE m.status = 'published' ORDER BY m.slug`,
            [],
        );
    }
}
