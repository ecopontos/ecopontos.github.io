import type { SqlitePort } from '../../application/ports/SqlitePort';
import { FORM_DEFINITION_ATIVO } from '../../infrastructure/persistence/sqlite/queries/forms';

export class GetFormDefinitionUseCase {
    constructor(private readonly db: SqlitePort) {}

    async execute(formId: string): Promise<unknown | null> {
        const rows = await this.db.query<{ conteudo: string }>(
            FORM_DEFINITION_ATIVO.sql,
            [formId],
        );
        if (!rows[0]) return null;
        try {
            return JSON.parse(rows[0].conteudo);
        } catch {
            return null;
        }
    }
}
