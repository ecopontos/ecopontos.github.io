import type { DataRegistryRepository } from '../../domain/data-registry/DataRegistryRepository';
import type { ClockPort } from '../ports/ClockPort';
import type { SqlitePort } from '../ports/SqlitePort';
import { uuidv7 } from 'ecoforms-core';
import { FORM_REGISTRY_GET } from '../../infrastructure/persistence/sqlite/queries/forms';

export interface RegistryMapping {
    fieldId: string;
    targetKey: string;
}

export interface SubmitToRegistryInput {
    /** Target tipo in registro_dados */
    tipo: string;
    /** Form submission data */
    formData: Record<string, unknown>;
    /** Optional: explicit field → key mappings. If omitted, uses fieldId as key. */
    mappings?: RegistryMapping[];
    /** Optional: key for the registry entry (defaults to uuidv7) */
    entryKey?: string;
}

export interface SubmitToRegistryResult {
    id: string;
    tipo: string;
    chave: string;
    created: boolean;
}

/**
 * Use case that writes form submission data into the Data Registry.
 *
 * Supports two modes:
 * 1. Simple: all formData fields become conteudo keys (fieldId → key)
 * 2. Mapped: explicit RegistryMapping array defines fieldId → targetKey
 *
 * If an entry with the same (tipo, chave) exists, it updates conteudo.
 * Otherwise, it creates a new entry.
 */
export class SubmitToRegistryUseCase {
    constructor(
        private readonly repo: DataRegistryRepository,
        private readonly clock: ClockPort,
    ) {}

    async execute(input: SubmitToRegistryInput): Promise<SubmitToRegistryResult> {
        const now = this.clock.nowIso();
        const chave = input.entryKey ?? uuidv7();

        // Build conteudo from formData
        const conteudo: Record<string, unknown> = {};

        if (input.mappings && input.mappings.length > 0) {
            for (const mapping of input.mappings) {
                const val = input.formData[mapping.fieldId];
                if (val !== undefined) {
                    conteudo[mapping.targetKey] = val;
                }
            }
        } else {
            // Direct mapping: fieldId → key
            for (const [key, val] of Object.entries(input.formData)) {
                conteudo[key] = val;
            }
        }

        // Check if entry exists
        const existing = await this.repo.findByTipoAndConteudo(input.tipo, '');
        // We need to check by tipo + a synthetic key lookup — since findByTipoAndConteudo
        // matches exact conteudo string, we do a broader search and filter.
        const itemsByTipo = await this.repo.findByTipo(input.tipo);

        // For simplicity, we always create a new entry unless entryKey is provided.
        // When entryKey is provided, we try to find and update.
        let created = true;

        if (input.entryKey) {
            const found = itemsByTipo.find(item => {
                const c = item.conteudo;
                if (typeof c === 'object' && c !== null && !Array.isArray(c)) {
                    return (c as Record<string, unknown>)._registryKey === input.entryKey;
                }
                return false;
            });
            if (found) {
                conteudo._registryKey = input.entryKey;
                found.updateConteudo(conteudo);
                await this.repo.save(found);
                created = false;
                return {
                    id: found.id,
                    tipo: input.tipo,
                    chave: found.id,
                    created: false,
                };
            }
        }

        // Create new entry
        const { DataRegistryItem } = await import('../../domain/data-registry/DataRegistryItem');
        const item = DataRegistryItem.fromProps({
            id: uuidv7(),
            tipo: input.tipo,
            conteudo,
            criadoEm: now,
            atualizadoEm: now,
        });
        await this.repo.save(item);

        return {
            id: item.id,
            tipo: input.tipo,
            chave: item.id,
            created: true,
        };
    }
}

/**
 * Use case that resolves which registry types a form references via dataSource.
 * Used for dependency tracking and reverse lookup.
 */
export class ResolveFormDataSourceTypesUseCase {
    constructor(private readonly sqlite: SqlitePort) {}

    async execute(formId: string): Promise<string[]> {
        const rows = await this.sqlite.query<{ conteudo: string }>(
            FORM_REGISTRY_GET.sql,
            [formId],
        );
        const conteudo = rows[0]?.conteudo;
        if (!conteudo) return [];

        let content: unknown;
        try {
            content = JSON.parse(conteudo);
        } catch {
            return [];
        }

        if (!content || typeof content !== 'object' || !Array.isArray((content as Record<string, unknown>).campos)) {
            return [];
        }

        const tipos = new Set<string>();
        const campos = (content as Record<string, unknown>).campos as Record<string, unknown>[];

        const extractFromFields = (fields: Record<string, unknown>[]) => {
            for (const field of fields) {
                const ds = field.dataSource;
                if (typeof ds === 'string' && ds.length > 0) {
                    tipos.add(ds);
                }
                // Recurse into nested fields (groups)
                if (Array.isArray(field.campos)) {
                    extractFromFields(field.campos as Record<string, unknown>[]);
                }
            }
        };

        extractFromFields(campos);
        return [...tipos];
    }
}

/**
 * Use case that finds all forms that reference a given Data Registry type.
 * This is the reverse lookup / dependency tracking mechanism.
 */
export class FindFormsUsingRegistryTypeUseCase {
    constructor(private readonly sqlite: SqlitePort) {}

    async execute(tipo: string): Promise<Array<{ form_id: string; titulo: string }>> {
        const rows = await this.sqlite.query<{ form_id: string; titulo: string; conteudo: string }>(
            `SELECT form_id, titulo, conteudo FROM registro_formularios WHERE ativo = 1`,
        );

        const result: Array<{ form_id: string; titulo: string }> = [];

        for (const row of rows) {
            let content: unknown;
            try {
                content = JSON.parse(row.conteudo);
            } catch {
                continue;
            }

            if (!content || typeof content !== 'object' || !Array.isArray((content as Record<string, unknown>).campos)) {
                continue;
            }

            const campos = (content as Record<string, unknown>).campos as Record<string, unknown>[];
            let usesTipo = false;

            const checkFields = (fields: Record<string, unknown>[]) => {
                for (const field of fields) {
                    const ds = field.dataSource;
                    if (ds === tipo) {
                        usesTipo = true;
                        return;
                    }
                    if (Array.isArray(field.campos)) {
                        checkFields(field.campos as Record<string, unknown>[]);
                    }
                    if (usesTipo) return;
                }
            };

            checkFields(campos);

            if (usesTipo) {
                result.push({ form_id: row.form_id, titulo: row.titulo });
            }
        }

        return result;
    }
}
