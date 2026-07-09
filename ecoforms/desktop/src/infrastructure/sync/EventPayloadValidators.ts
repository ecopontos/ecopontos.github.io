import type { EventEnvelope } from './EventEnvelope';

type PayloadRecord = Record<string, unknown>;

const TASK_STATUSES = new Set(['a_fazer', 'em_progresso', 'em_andamento', 'concluido', 'cancelado', 'arquivado']);
const TASK_PRIORITIES = new Set(['baixa', 'media', 'alta']);
const MANIFESTACAO_ALLOWED_FIELDS = new Set([
    'id', 'manifestacaoId', 'protocolo', 'tipo_id', 'origem_id', 'classificacao_id',
    'situacao_id', 'cliente_id', 'obs_solicitante', 'solicitante_nome',
    'solicitante_email', 'solicitante_telefone', 'assunto', 'descricao',
    'prioridade', 'status', 'responsavel_id', 'setor_id', 'anonimo', 'sigiloso',
    'prazo_limite', 'cancelamento_motivo', 'atribuido_em', 'aceite_em',
    'avaliacao_satisfacao', 'avaliacao_comentario', 'avaliacao_em',
    'manifestacao_origem_id', 'competencia', 'motivo_incompetencia',
    'orgao_destino', 'data_competencia', 'subassunto_id', 'subunidade_id',
    'programa_orcamentario_id', 'criado_em', 'atualizado_em', 'encerrado_em',
]);

function isRecord(value: unknown): value is PayloadRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function optionalString(value: unknown): boolean {
    return value === undefined || value === null || typeof value === 'string';
}

function optionalBoolean(value: unknown): boolean {
    return value === undefined || typeof value === 'boolean';
}

function optionalNumber(value: unknown): boolean {
    return value === undefined || value === null || typeof value === 'number';
}

function requireOneString(data: PayloadRecord, keys: string[], label: string, errors: string[]): void {
    if (!keys.some(key => isNonEmptyString(data[key]))) {
        errors.push(`${label} is required`);
    }
}

function assertOptionalString(data: PayloadRecord, keys: string[], errors: string[]): void {
    for (const key of keys) {
        if (!optionalString(data[key])) errors.push(`${key} must be a string or null`);
    }
}

function assertEnum(data: PayloadRecord, key: string, allowed: Set<string>, errors: string[]): void {
    const value = data[key];
    if (value !== undefined && value !== null && (typeof value !== 'string' || !allowed.has(value))) {
        errors.push(`${key} must be one of: ${[...allowed].join(', ')}`);
    }
}

function validateTaskPayload(env: EventEnvelope, data: PayloadRecord, errors: string[]): void {
    switch (env.type) {
        case 'task.criada':
            requireOneString(data, ['id'], 'id', errors);
            assertOptionalString(data, [
                'titulo', 'descricao', 'atribuido_para', 'atribuidoPara', 'demanda_id',
                'demandaId', 'suite_id', 'prazo', 'criado_por', 'criado_em',
            ], errors);
            assertEnum(data, 'status', TASK_STATUSES, errors);
            assertEnum(data, 'prioridade', TASK_PRIORITIES, errors);
            break;
        case 'task.movida':
        case 'task.concluida':
        case 'task.atualizada':
        case 'task.arquivada':
        case 'task.desarquivada':
        case 'task.excluida':
            requireOneString(data, ['tarefa_id', 'tarefaId'], 'tarefa_id', errors);
            assertOptionalString(data, ['demanda_id', 'demandaId', 'status', 'novo_status'], errors);
            assertEnum(data, 'status', TASK_STATUSES, errors);
            assertEnum(data, 'novo_status', TASK_STATUSES, errors);
            break;
        case 'task.comentario_adicionado':
            requireOneString(data, ['tarefa_id', 'tarefaId'], 'tarefa_id', errors);
            requireOneString(data, ['comentario'], 'comentario', errors);
            assertOptionalString(data, ['usuario_id', 'usuarioId'], errors);
            break;
    }
}

function validateUsuarioPayload(env: EventEnvelope, data: PayloadRecord, errors: string[]): void {
    assertOptionalString(data, [
        'nome', 'nome_usuario', 'username', 'hash_senha', 'perfil', 'setor_principal_id', 'setor',
    ], errors);
    if (!optionalBoolean(data.ativo)) errors.push('ativo must be boolean when present');
    if (env.type === 'usuario.atualizado') {
        const recognised = ['nome', 'nome_usuario', 'username', 'perfil', 'ativo', 'setor_principal_id', 'setor'];
        if (!recognised.some(key => data[key] !== undefined)) {
            errors.push('usuario.atualizado must include at least one recognised field');
        }
    }
}

function validateManifestacaoPayload(env: EventEnvelope, data: PayloadRecord, errors: string[]): void {
    if (env.type === 'manifestacao.criada') {
        if (isNonEmptyString(data.id) && data.id !== env.aggregate.id) {
            errors.push('id must match aggregate.id');
        }
        for (const key of Object.keys(data)) {
            if (!MANIFESTACAO_ALLOWED_FIELDS.has(key)) {
                errors.push(`${key} is not an allowed manifestacao field`);
            }
        }
        assertOptionalString(data, [
            'id', 'manifestacaoId', 'protocolo', 'tipo_id', 'origem_id', 'classificacao_id',
            'situacao_id', 'cliente_id', 'assunto', 'descricao', 'prioridade', 'status',
            'responsavel_id', 'setor_id',
        ], errors);
        if (!optionalBoolean(data.anonimo)) errors.push('anonimo must be boolean when present');
        if (!optionalBoolean(data.sigiloso)) errors.push('sigiloso must be boolean when present');
        if (!optionalNumber(data.avaliacao_satisfacao)) errors.push('avaliacao_satisfacao must be number when present');
        return;
    }

    if (env.type === 'manifestacao.status_atualizado') {
        requireOneString(data, ['status'], 'status', errors);
    }
}

function validateSuitePayload(data: PayloadRecord, errors: string[]): void {
    requireOneString(data, ['packageId', 'suiteId'], 'packageId or suiteId', errors);
    assertOptionalString(data, ['motivo', 'comentario', 'observacao', 'targetUserId', 'target_user_id'], errors);
}

function validateClientPayload(data: PayloadRecord, errors: string[]): void {
    requireOneString(data, ['id', 'uuid'], 'id or uuid', errors);
    assertOptionalString(data, [
        'id', 'uuid', 'Cliente', 'CNPJ', 'Telefone', 'Telefone2', 'Email', 'CEP',
        'Endereco', 'Numero', 'Bairro', 'Cidade', 'Estado', 'idPJtipo',
    ], errors);
    if (!optionalNumber(data.Inativo)) errors.push('Inativo must be number when present');
}

export function validateEventPayload(envelope: EventEnvelope): string[] {
    const errors: string[] = [];
    if (!isRecord(envelope.data)) return ['data must be an object'];
    const data = envelope.data;

    if (envelope.type.startsWith('task.')) validateTaskPayload(envelope, data, errors);
    if (envelope.type.startsWith('usuario.')) validateUsuarioPayload(envelope, data, errors);
    if (envelope.type.startsWith('manifestacao.')) validateManifestacaoPayload(envelope, data, errors);
    if (envelope.type.startsWith('suite.')) validateSuitePayload(data, errors);
    if (envelope.type === 'client.criado' || envelope.type === 'client.atualizado') validateClientPayload(data, errors);
    if (envelope.type === 'crm.cliente.criado' || envelope.type === 'crm.cliente.atualizado') validateClientPayload(data, errors);

    return errors;
}

export function assertValidEventPayload(envelope: EventEnvelope): void {
    const errors = validateEventPayload(envelope);
    if (errors.length > 0) {
        throw new Error(`Invalid EventPayload for ${envelope.type}: ${errors.join('; ')}`);
    }
}
