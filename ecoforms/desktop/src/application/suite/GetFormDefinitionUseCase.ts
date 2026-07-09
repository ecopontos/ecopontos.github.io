import type { SqlitePort } from '../../application/ports/SqlitePort';
import { parsePersistedJsonRecord } from '../json/jsonPersistence';

export class GetFormDefinitionUseCase {
    constructor(private readonly db: SqlitePort) {}

    async execute(formId: string): Promise<unknown | null> {
        const rows = await this.db.query<{ conteudo: string }>(
            `SELECT conteudo FROM registro_formularios WHERE form_id = ? AND ativo = 1 LIMIT 1`,
            [formId],
        );
        if (!rows[0]) return null;
        return parsePersistedJsonRecord(rows[0].conteudo);
    }
}
