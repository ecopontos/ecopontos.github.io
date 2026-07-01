import { SuitePackage, type SuitePackageProps } from '../../../domain/suite/SuitePackage';
import type { SuiteHistoryEntry, SuiteQuery, SuiteRepository } from '../../../domain/suite/SuiteRepository';
import type { SuiteStatus } from '../../../domain/suite/SuiteStatus';
import type { SqlitePort } from '../../../application/ports/SqlitePort';
import { uuidv7 } from 'ecoforms-core';

interface SuiteRow {
    id_pacote: string;
    num_versao: number;
    tipo_modulo: string;
    tipo_recurso: string;
    status: SuiteStatus;
    id_proprietario: string | null;
    atual: number;
    bloqueado_por: string | null;
    bloqueado_em: string | null;
    ref_id_pacote: string | null;
    ref_versao_pacote: number | null;
    id_entidade: string | null;
    tipo_entidade: string | null;
    carga_json: string;
    criado_em: string;
    fechado_em: string | null;
}

const SELECT_COLS = [
    'id_pacote', 'num_versao', 'tipo_modulo', 'tipo_recurso', 'status',
    'id_proprietario', 'atual', 'bloqueado_por', 'bloqueado_em',
    'ref_id_pacote', 'ref_versao_pacote', 'id_entidade', 'tipo_entidade',
    'carga_json', 'criado_em', 'fechado_em',
].join(', ');

function rowToEntity(row: SuiteRow): SuitePackage {
    const props: SuitePackageProps = {
        packageId: row.id_pacote,
        versionNo: row.num_versao,
        moduleType: row.tipo_modulo,
        resourceType: row.tipo_recurso,
        status: row.status,
        ownerId: row.id_proprietario,
        isCurrent: row.atual === 1,
        lockedBy: row.bloqueado_por,
        lockedAt: row.bloqueado_em,
        refPackageId: row.ref_id_pacote,
        refPackageVer: row.ref_versao_pacote,
        entityId: row.id_entidade,
        entityType: row.tipo_entidade,
        payloadJson: row.carga_json,
        createdAt: row.criado_em,
        closedAt: row.fechado_em,
    };
    return SuitePackage.fromProps(props);
}

export class SqliteSuiteRepository implements SuiteRepository {
    constructor(private readonly db: SqlitePort) {}

    async findById(packageId: string): Promise<SuitePackage | null> {
        const rows = await this.db.query<SuiteRow>(
            `SELECT ${SELECT_COLS} FROM pacotes 
             WHERE id_pacote = ? AND atual = 1
             ORDER BY num_versao DESC LIMIT 1`,
            [packageId],
        );
        return rows[0] ? rowToEntity(rows[0]) : null;
    }

    async findCurrent(resourceType: string, ownerId?: string): Promise<SuitePackage[]> {
        const rows = ownerId
            ? await this.db.query<SuiteRow>(
                `SELECT ${SELECT_COLS} FROM pacotes
                 WHERE tipo_recurso = ? AND id_proprietario = ? AND atual = 1
                 ORDER BY criado_em DESC`,
                [resourceType, ownerId],
            )
            : await this.db.query<SuiteRow>(
                `SELECT ${SELECT_COLS} FROM pacotes
                 WHERE tipo_recurso = ? AND atual = 1
                 ORDER BY criado_em DESC`,
                [resourceType],
            );
        return rows.map(rowToEntity);
    }

    async query(filter: SuiteQuery): Promise<SuitePackage[]> {
        const clauses: string[] = [];
        const params: unknown[] = [];
        if (filter.ownerId) { clauses.push('id_proprietario = ?'); params.push(filter.ownerId); }
        if (filter.moduleType) { clauses.push('tipo_modulo = ?'); params.push(filter.moduleType); }
        if (filter.resourceType) { clauses.push('tipo_recurso = ?'); params.push(filter.resourceType); }
        if (filter.isCurrent !== undefined) { clauses.push('atual = ?'); params.push(filter.isCurrent ? 1 : 0); }
        if (filter.entityId) { clauses.push('id_entidade = ?'); params.push(filter.entityId); }
        if (filter.entityType) { clauses.push('tipo_entidade = ?'); params.push(filter.entityType); }
        if (filter.status) {
            const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
            const placeholders = statuses.map(() => '?').join(', ');
            clauses.push(`status IN (${placeholders})`);
            params.push(...statuses);
        }

        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        const limit = filter.limit ? `LIMIT ${Math.max(1, Math.floor(filter.limit))}` : '';
        const sql = `SELECT ${SELECT_COLS} FROM pacotes ${where} ORDER BY criado_em DESC ${limit}`.trim();
        const rows = await this.db.query<SuiteRow>(sql, params);
        return rows.map(rowToEntity);
    }

    async invalidateCurrent(packageId: string): Promise<void> {
        await this.db.execute(
            `UPDATE pacotes SET atual = 0 WHERE id_pacote = ? AND atual = 1`,
            [packageId],
        );
    }

    async save(pkg: SuitePackage): Promise<void> {
        const p = pkg.toProps();
        
        // Append-Only Pattern:
        // 1. Marcar versÃµes anteriores como nÃ£o atuais
        await this.invalidateCurrent(p.packageId);

        // 2. Inserir nova versÃ£o
        await this.db.execute(
            `INSERT INTO pacotes (
                id_pacote, num_versao, tipo_modulo, tipo_recurso, status,
                id_proprietario, atual, bloqueado_por, bloqueado_em,
                ref_id_pacote, ref_versao_pacote, id_entidade, tipo_entidade,
                carga_json, criado_em, fechado_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), ?)`,
            [
                p.packageId, p.versionNo, p.moduleType, p.resourceType, p.status,
                p.ownerId, p.isCurrent ? 1 : 0, p.lockedBy, p.lockedAt,
                p.refPackageId, p.refPackageVer, p.entityId, p.entityType,
                p.payloadJson, p.createdAt || null, p.closedAt,
            ],
        );
    }

    async appendHistory(entry: SuiteHistoryEntry): Promise<void> {
        await this.db.execute(
            `INSERT INTO historico_pacotes (
                id, registro_id, status_anterior, status_novo, alterado_por,
                motivo, metadados, id_pacote, versao_de, versao_para, tipo_transferencia
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                uuidv7(),
                entry.packageId,
                entry.statusAnterior,
                entry.statusNovo,
                entry.alteradoPor,
                entry.motivo ?? null,
                null,
                entry.packageId,
                entry.versionFrom,
                entry.versionTo,
                entry.transferType ?? null,
            ],
        );
    }


    async validateNoCycle(packageId: string, refPackageId: string, maxDepth = 50): Promise<boolean> {
        if (!refPackageId) return true;

        if (packageId === refPackageId) {
            console.warn(`[SuiteRepo] Ciclo detectado: ${packageId} referencia a si mesmo`);
            return false;
        }

        const visited = new Set<string>([packageId]);
        let currentId = refPackageId;
        let depth = 0;

        while (depth < maxDepth) {
            const rows = await this.db.query<{ ref_id_pacote: string | null }>(
                `SELECT ref_id_pacote FROM pacotes WHERE id_pacote = ? AND atual = 1 LIMIT 1`,
                [currentId]
            );

            if (rows.length === 0) return true;

            const nextRef = rows[0].ref_id_pacote;
            if (!nextRef) return true;

            if (visited.has(currentId)) {
                console.warn(`[SuiteRepo] Ciclo detectado: ${packageId} -> ... -> ${nextRef}`);
                return false;
            }

            visited.add(currentId);
            currentId = nextRef;
            depth++;
        }

        console.warn(`[SuiteRepo] Profundidade maxima (${maxDepth}) atingida ao validar ciclo: ${packageId} -> ${refPackageId}`);
        return false;
    }

    async getFormTemplate(slug: string): Promise<Record<string, unknown> | null> {
        const rows = await this.db.query<{ conteudo: unknown }>(
            `SELECT conteudo FROM registro_formularios WHERE slug = ? OR form_id = ? LIMIT 1`,
            [slug, slug],
        );
        if (!rows || rows.length === 0) return null;
        try {
            const raw = rows[0].conteudo;
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return typeof parsed === 'string' ? JSON.parse(parsed) : (parsed as Record<string, unknown>);
        } catch (e) {
            console.error('[SuiteRepo] Error parsing form template:', e);
            return null;
        }
    }
}



