/**
 * FormMigrationEngine - Sistema de migração de dados entre versões
 * 
 * Aplica transformações automáticas e manuais em dados coletados
 * quando o schema do formulário muda.
 * 
 * Features:
 * - Migrations automáticas para mudanças simples
 * - Migrations manuais para transformações complexas
 * - Rollback de migrations
 * - Validação pós-migração
 * - Batch processing para grandes volumes
 * 
 * @example
 * const migrationEngine = new FormMigrationEngine();
 * 
 * // Registrar migration manual
 * migrationEngine.registerMigration('form-1', '1.0.0', '2.0.0', {
 *   up: (data) => {
 *     data.newField = data.oldField * 2;
 *     delete data.oldField;
 *     return data;
 *   },
 *   down: (data) => {
 *     data.oldField = data.newField / 2;
 *     delete data.newField;
 *     return data;
 *   }
 * });
 * 
 * // Migrar dados
 * const migrated = await migrationEngine.migrate(data, '1.0.0', '2.0.0');
 */

import { eventBus } from './EventEmitter.js';

export class FormMigrationEngine {
    constructor(options = {}) {
        this.options = {
            autoMigration: true,
            validateAfterMigration: true,
            batchSize: 100,
            ...options
        };

        this.migrations = new Map(); // formId -> version -> migration
        this.migrationHistory = [];
    }

    /**
     * Registra uma migration manual
     * @param {string} formId - ID do formulário
     * @param {string} fromVersion - Versão de origem
     * @param {string} toVersion - Versão de destino
     * @param {object} migration - Funções up/down
     */
    registerMigration(formId, fromVersion, toVersion, migration) {
        const key = `${formId}:${fromVersion}:${toVersion}`;
        
        if (!migration.up || typeof migration.up !== 'function') {
            throw new Error('Migration deve ter função "up"');
        }

        this.migrations.set(key, {
            formId,
            fromVersion,
            toVersion,
            up: migration.up,
            down: migration.down || null,
            description: migration.description || 'Sem descrição'
        });

        console.log(`✅ Migration registrada: ${formId} ${fromVersion} → ${toVersion}`);
    }

    /**
     * Migra um registro de dados
     * @param {object} data - Dados do registro
     * @param {string} fromVersion - Versão atual dos dados
     * @param {string} toVersion - Versão alvo
     * @param {object} oldSchema - Schema antigo
     * @param {object} newSchema - Schema novo
     * @returns {Promise<object>} - Dados migrados
     */
    async migrate(data, fromVersion, toVersion, oldSchema, newSchema) {
        const formId = data.formId || oldSchema.id;

        console.log(`🔄 Migrando registro de ${fromVersion} para ${toVersion}`);

        // Criar cópia dos dados
        let migratedData = this.deepClone(data);

        // Aplicar migration manual se existir
        const manualMigration = this.getMigration(formId, fromVersion, toVersion);
        
        if (manualMigration) {
            console.log(`  ⚙️ Aplicando migration manual: ${manualMigration.description}`);
            
            try {
                migratedData = await manualMigration.up(migratedData, oldSchema, newSchema);
            } catch (error) {
                console.error('❌ Erro na migration manual:', error);
                throw new Error(`Migration manual falhou: ${error.message}`);
            }
        } else if (this.options.autoMigration) {
            // Aplicar auto-migration
            console.log(`  🤖 Aplicando auto-migration`);
            migratedData = this.autoMigrate(migratedData, oldSchema, newSchema);
        }

        // Atualizar schema_version
        migratedData._schema_version = toVersion;
        migratedData._migrated_at = new Date().toISOString();
        migratedData._migration_from = fromVersion;

        // Validar após migração
        if (this.options.validateAfterMigration) {
            const valid = this.validateMigratedData(migratedData, newSchema);
            
            if (!valid) {
                console.warn('⚠️ Dados migrados não passaram na validação');
            }
        }

        // Registrar no histórico
        this.migrationHistory.push({
            formId,
            fromVersion,
            toVersion,
            timestamp: new Date().toISOString(),
            recordId: data.id,
            success: true
        });

        eventBus.emit('formMigration:completed', {
            formId,
            fromVersion,
            toVersion,
            recordId: data.id
        });

        console.log(`✅ Migração completa`);

        return migratedData;
    }

    /**
     * Auto-migração baseada em mudanças de schema
     */
    autoMigrate(data, oldSchema, newSchema) {
        const migratedData = this.deepClone(data);
        
        const oldFields = this.extractFields(oldSchema);
        const newFields = this.extractFields(newSchema);

        const oldFieldMap = new Map(oldFields.map(f => [f.id, f]));
        const newFieldMap = new Map(newFields.map(f => [f.id, f]));

        // 1. Remover campos que não existem mais no novo schema
        for (const fieldId of Object.keys(migratedData)) {
            if (fieldId.startsWith('_')) continue; // Pular metadados
            
            if (!newFieldMap.has(fieldId)) {
                console.log(`  🗑️ Removendo campo obsoleto: ${fieldId}`);
                delete migratedData[fieldId];
            }
        }

        // 2. Adicionar campos novos com valores default
        for (const [fieldId, field] of newFieldMap) {
            if (!(fieldId in migratedData)) {
                const defaultValue = this.getDefaultValue(field);
                
                if (defaultValue !== undefined) {
                    console.log(`  ➕ Adicionando campo novo: ${fieldId} = ${JSON.stringify(defaultValue)}`);
                    migratedData[fieldId] = defaultValue;
                }
            }
        }

        // 3. Transformar tipos de campos que mudaram
        for (const [fieldId, newField] of newFieldMap) {
            if (oldFieldMap.has(fieldId)) {
                const oldField = oldFieldMap.get(fieldId);
                
                if (oldField.type !== newField.type && fieldId in migratedData) {
                    console.log(`  🔄 Convertendo tipo: ${fieldId} (${oldField.type} → ${newField.type})`);
                    
                    migratedData[fieldId] = this.convertFieldType(
                        migratedData[fieldId],
                        oldField.type,
                        newField.type
                    );
                }
            }
        }

        return migratedData;
    }

    /**
     * Converte valor de um tipo para outro
     */
    convertFieldType(value, fromType, toType) {
        if (value === null || value === undefined) return value;

        // String → Number
        if (fromType === 'text' && toType === 'number') {
            const num = parseFloat(value);
            return isNaN(num) ? 0 : num;
        }

        // Number → String
        if (fromType === 'number' && toType === 'text') {
            return String(value);
        }

        // Boolean → String
        if (fromType === 'checkbox' && toType === 'text') {
            return value ? 'Sim' : 'Não';
        }

        // String → Boolean
        if (fromType === 'text' && toType === 'checkbox') {
            return ['sim', 'yes', 'true', '1'].includes(String(value).toLowerCase());
        }

        // Array → String
        if (Array.isArray(value) && toType === 'text') {
            return value.join(', ');
        }

        // String → Array
        if (typeof value === 'string' && toType === 'chips') {
            return value.split(',').map(s => s.trim()).filter(Boolean);
        }

        // Fallback: retornar valor original
        console.warn(`⚠️ Conversão não suportada: ${fromType} → ${toType}`);
        return value;
    }

    /**
     * Obtém valor default para campo
     */
    getDefaultValue(field) {
        if (field.defaultValue !== undefined) {
            return field.defaultValue;
        }

        switch (field.type) {
            case 'text':
            case 'textarea':
            case 'email':
            case 'tel':
                return '';
            
            case 'number':
                return field.validation?.min || 0;
            
            case 'checkbox':
                return false;
            
            case 'radio':
            case 'select':
                return field.options?.[0]?.value || '';
            
            case 'chips':
                return [];
            
            case 'date':
            case 'datetime-local':
                return null;
            
            default:
                return null;
        }
    }

    /**
     * Migra múltiplos registros em lote
     * @param {array} records - Lista de registros
     * @param {string} fromVersion - Versão de origem
     * @param {string} toVersion - Versão alvo
     * @param {object} oldSchema - Schema antigo
     * @param {object} newSchema - Schema novo
     * @returns {Promise<object>} - Resultado da migração
     */
    async migrateBatch(records, fromVersion, toVersion, oldSchema, newSchema) {
        const results = {
            total: records.length,
            migrated: 0,
            failed: 0,
            errors: []
        };

        const batches = this.createBatches(records, this.options.batchSize);
        
        console.log(`🔄 Migrando ${records.length} registros em ${batches.length} lotes`);

        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            
            console.log(`  📦 Processando lote ${i + 1}/${batches.length} (${batch.length} registros)`);

            for (const record of batch) {
                try {
                    await this.migrate(record, fromVersion, toVersion, oldSchema, newSchema);
                    results.migrated++;
                } catch (error) {
                    results.failed++;
                    results.errors.push({
                        recordId: record.id,
                        error: error.message
                    });
                    
                    console.error(`  ❌ Erro ao migrar registro ${record.id}:`, error);
                }
            }

            // Emitir progresso
            eventBus.emit('formMigration:progress', {
                total: results.total,
                current: results.migrated + results.failed,
                migrated: results.migrated,
                failed: results.failed
            });

            // Pequena pausa entre lotes para não bloquear UI
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        console.log(`✅ Migração em lote completa: ${results.migrated} sucesso, ${results.failed} falhas`);

        eventBus.emit('formMigration:batchCompleted', results);

        return results;
    }

    /**
     * Rollback de uma migration
     */
    async rollback(data, fromVersion, toVersion, oldSchema, newSchema) {
        const formId = data.formId || newSchema.id;
        const migration = this.getMigration(formId, fromVersion, toVersion);

        if (!migration || !migration.down) {
            throw new Error(`Rollback não disponível para ${formId} ${fromVersion} → ${toVersion}`);
        }

        console.log(`⏪ Fazendo rollback: ${toVersion} → ${fromVersion}`);

        try {
            const rolledBackData = await migration.down(data, newSchema, oldSchema);
            
            rolledBackData._schema_version = fromVersion;
            rolledBackData._rolled_back_at = new Date().toISOString();
            
            console.log(`✅ Rollback completo`);
            
            return rolledBackData;
        } catch (error) {
            console.error(`❌ Erro no rollback:`, error);
            throw new Error(`Rollback falhou: ${error.message}`);
        }
    }

    /**
     * Valida dados migrados contra novo schema
     */
    validateMigratedData(data, newSchema) {
        const fields = this.extractFields(newSchema);
        let valid = true;

        for (const field of fields) {
            // Verificar campos required
            if (field.required && (data[field.id] === undefined || data[field.id] === null || data[field.id] === '')) {
                console.warn(`⚠️ Campo required faltando: ${field.id}`);
                valid = false;
            }

            // Verificar tipo
            const value = data[field.id];
            if (value !== undefined && value !== null) {
                const typeValid = this.validateFieldType(value, field.type);
                
                if (!typeValid) {
                    console.warn(`⚠️ Tipo inválido para campo ${field.id}: esperado ${field.type}, recebido ${typeof value}`);
                    valid = false;
                }
            }
        }

        return valid;
    }

    /**
     * Valida tipo de valor de campo
     */
    validateFieldType(value, type) {
        switch (type) {
            case 'text':
            case 'textarea':
            case 'email':
            case 'tel':
                return typeof value === 'string';
            
            case 'number':
                return typeof value === 'number';
            
            case 'checkbox':
                return typeof value === 'boolean';
            
            case 'chips':
                return Array.isArray(value);
            
            case 'date':
            case 'datetime-local':
                return typeof value === 'string' || value instanceof Date;
            
            default:
                return true; // Aceitar qualquer tipo para tipos desconhecidos
        }
    }

    /**
     * Obtém migration registrada
     */
    getMigration(formId, fromVersion, toVersion) {
        const key = `${formId}:${fromVersion}:${toVersion}`;
        return this.migrations.get(key) || null;
    }

    /**
     * Lista todas as migrations registradas
     */
    listMigrations(formId = null) {
        const migrations = Array.from(this.migrations.values());
        
        if (formId) {
            return migrations.filter(m => m.formId === formId);
        }
        
        return migrations;
    }

    /**
     * Obtém histórico de migrações
     */
    getHistory(formId = null, recordId = null) {
        let history = this.migrationHistory;

        if (formId) {
            history = history.filter(h => h.formId === formId);
        }

        if (recordId) {
            history = history.filter(h => h.recordId === recordId);
        }

        return history;
    }

    /**
     * Limpa histórico
     */
    clearHistory() {
        this.migrationHistory = [];
    }

    /**
     * Cria lotes de registros
     */
    createBatches(records, batchSize) {
        const batches = [];
        
        for (let i = 0; i < records.length; i += batchSize) {
            batches.push(records.slice(i, i + batchSize));
        }
        
        return batches;
    }

    /**
     * Extrai campos do schema
     */
    extractFields(schema) {
        const fields = [];

        if (schema.fields) {
            fields.push(...schema.fields);
        }

        if (schema.sections) {
            for (const section of schema.sections) {
                if (section.fields) {
                    fields.push(...section.fields);
                }
            }
        }

        return fields;
    }

    /**
     * Deep clone de objeto
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
}

export default FormMigrationEngine;
