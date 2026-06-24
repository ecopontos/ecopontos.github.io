import { ServiceType } from '../../../domain/service/ServiceType';
import type { ServiceTypeRepository } from '../../../domain/service/ServiceTypeRepository';
import type { SqlitePort } from '../../../application/ports/SqlitePort';

interface ServiceTypeRow {
    id: string;
    nome: string;
    descricao: string | null;
    form_id: string | null;
    validator_key: string | null;
    requer_fotos: number;
    bairros_obrigatorios: number;
    requer_mapa: number;
    capacidade_padrao: number | null;
    icone: string | null;
    cor: string | null;
    ativo: number;
    abertura_regra: string | null;
    setor_id: string | null;
    criado_em: string;
    atualizado_em: string;
}

function rowToEntity(row: ServiceTypeRow): ServiceType {
    return ServiceType.fromProps({
        id: row.id,
        nome: row.nome,
        descricao: row.descricao,
        formId: row.form_id,
        validatorKey: row.validator_key,
        requerFotos: row.requer_fotos === 1,
        bairrosObrigatorios: row.bairros_obrigatorios === 1,
        requerMapa: row.requer_mapa === 1,
        capacidadePadrao: row.capacidade_padrao,
        icone: row.icone,
        cor: row.cor,
        ativo: row.ativo === 1,
        aberturaRegra: row.abertura_regra,
        setorId: row.setor_id,
        criadoEm: row.criado_em,
        atualizadoEm: row.atualizado_em,
    });
}

export class SqliteServiceTypeRepository implements ServiceTypeRepository {
    constructor(private readonly db: SqlitePort) {}

    async findById(id: string): Promise<ServiceType | null> {
        const rows = await this.db.query<ServiceTypeRow>(
            `SELECT * FROM tbl_service_types WHERE id = ? LIMIT 1`,
            [id],
        );
        return rows[0] ? rowToEntity(rows[0]) : null;
    }

    async findAll(ativo?: boolean): Promise<ServiceType[]> {
        const sql = ativo !== undefined
            ? `SELECT * FROM tbl_service_types WHERE ativo = ? ORDER BY nome`
            : `SELECT * FROM tbl_service_types ORDER BY nome`;
        const params = ativo !== undefined ? [ativo ? 1 : 0] : [];
        const rows = await this.db.query<ServiceTypeRow>(sql, params);
        return rows.map(rowToEntity);
    }

    async findBySetorIds(setorIds: string[], ativo?: boolean): Promise<ServiceType[]> {
        if (setorIds.length === 0) return [];
        const placeholders = setorIds.map(() => '?').join(',');
        const whereAtivo = ativo !== undefined ? 'AND ativo = ?' : '';
        const sql = `SELECT * FROM tbl_service_types WHERE setor_id IN (${placeholders}) ${whereAtivo} ORDER BY nome`;
        const params: unknown[] = [...setorIds];
        if (ativo !== undefined) params.push(ativo ? 1 : 0);
        const rows = await this.db.query<ServiceTypeRow>(sql, params);
        return rows.map(rowToEntity);
    }

    async save(type: ServiceType): Promise<void> {
        const p = type.toProps();
        await this.db.execute(
            `INSERT INTO tbl_service_types (
                id, nome, descricao, form_id, validator_key,
                requer_fotos, bairros_obrigatorios, requer_mapa, capacidade_padrao,
                icone, cor, ativo, setor_id, criado_em, atualizado_em
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
                nome = excluded.nome,
                descricao = excluded.descricao,
                form_id = excluded.form_id,
                validator_key = excluded.validator_key,
                requer_fotos = excluded.requer_fotos,
                bairros_obrigatorios = excluded.bairros_obrigatorios,
                requer_mapa = excluded.requer_mapa,
                capacidade_padrao = excluded.capacidade_padrao,
                icone = excluded.icone,
                cor = excluded.cor,
                ativo = excluded.ativo,
                setor_id = excluded.setor_id,
                atualizado_em = excluded.atualizado_em`,
            [
                p.id, p.nome, p.descricao ?? null, p.formId ?? null, p.validatorKey ?? null,
                p.requerFotos ? 1 : 0, p.bairrosObrigatorios ? 1 : 0, p.requerMapa ? 1 : 0, p.capacidadePadrao ?? null,
                p.icone ?? null, p.cor ?? null, p.ativo ? 1 : 0, p.setorId ?? null, p.criadoEm, p.atualizadoEm,
            ],
        );
    }
}
