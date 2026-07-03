/**
 * Helpers para extrair referencias a tipos do Data Registry a partir de campos
 * de formulario (schema autorado ou conteudo persistido em registro_formularios).
 *
 * Antes (bug H) so `field.dataSource` era considerado, ignorando o alias legado
 * `field.source`. Agora ambos sao levados em conta por resolveFormDataSourceTypes
 * e findFormsUsingRegistryType.
 */

/**
 * Retorna o tipo do Data Registry referenciado por um campo, considerando
 * `dataSource` (canonico) e `source` (alias legado). Retorna undefined se nenhum.
 */
export function getFieldDataSource(field: Record<string, unknown>): string | undefined {
    const ds = field.dataSource;
    if (typeof ds === 'string' && ds.length > 0) return ds;
    const src = field.source;
    if (typeof src === 'string' && src.length > 0) return src;
    return undefined;
}
