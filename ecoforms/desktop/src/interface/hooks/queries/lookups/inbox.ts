import { getContainerAsync } from '../../utils/useContainer';
import { INBOX_NORMALIZADA_VIEW } from '@/src/infrastructure/persistence/sqlite/queries/inbox_view';

export async function fetchInboxNormalizada(args: {
  accessClause: string;
  accessParams: unknown[];
  searchTerm: string;
}): Promise<Record<string, unknown>[]> {
  const c = await getContainerAsync();
  const searchClause = args.searchTerm
    ? 'AND v.id IN (SELECT suite_id FROM pacotes_fts WHERE texto_busca MATCH ?) ORDER BY v.criado_em DESC'
    : 'ORDER BY v.criado_em DESC';
  const sql = INBOX_NORMALIZADA_VIEW.sql
    .replace('{{ACCESS_CLAUSE}}', args.accessClause)
    .replace('{{SEARCH_CLAUSE}}', searchClause);
  const params = args.searchTerm
    ? [...args.accessParams, '"' + args.searchTerm + '"*']
    : [...args.accessParams];
  return c.sqlite.query<Record<string, unknown>>(sql, params);
}
