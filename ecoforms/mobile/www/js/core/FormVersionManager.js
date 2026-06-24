/**
 * FormVersionManager - Sistema de versionamento de formulários
 * 
 * Gerencia versões de formulários, detecta mudanças estruturais,
 * e mantém compatibilidade com dados coletados em versões anteriores.
 * 
 * Features:
 * - Versionamento semântico automático (major.minor.patch)
 * - Detecção de breaking changes
 * - Histórico de alterações
 * - Comparação entre versões
 * - Validação de compatibilidade
 * 
 * @example
 * const versionManager = new FormVersionManager();
 * 
 * // Criar nova versão
 * const newVersion = await versionManager.createVersion(formId, newSchema, {
 *   changelog: 'Adicionado campo "observações"',
 *   breaking: false
 * });
 * 
 * // Obter versão específica
 * const schema = await versionManager.getVersion(formId, '1.2.0');
 */

import { eventBus } from './EventEmitter.js';

export class FormVersionManager {
    constructor(options = {}) {
        this.options = {
            storage: 'supabase', // ou 'indexeddb'
            autoVersioning: true,
            breakingChangeDetection: true,
            maxVersionHistory: 50,
            ...options
        };

        this.dbName = 'ecoforms-versions';
        this.db = null;
        this.initialized = false;
    }

    /**
     * Inicializa o gerenciador
     */
    async initialize() {
        if (this.initialized) return;

        if (this.options.storage === 'indexeddb') {
            await this.initIndexedDB();
        }

        this.initialized = true;
        eventBus.emit('formVersionManager:initialized');
    }

    /**
     * Inicializa IndexedDB
     */
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Store de versões
                if (!db.objectStoreNames.contains('versions')) {
                    const versionStore = db.createObjectStore('versions', { 
                        keyPath: 'id',
                        autoIncrement: true 
                    });
                    versionStore.createIndex('formId', 'formId', { unique: false });
                    versionStore.createIndex('version', ['formId', 'version'], { unique: true });
                    versionStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Store de comparações/diffs
                if (!db.objectStoreNames.contains('diffs')) {
                    const diffStore = db.createObjectStore('diffs', { 
                        keyPath: 'id',
                        autoIncrement: true 
                    });
                    diffStore.createIndex('formId', 'formId', { unique: false });
                    diffStore.createIndex('versions', ['formId', 'fromVersion', 'toVersion'], { unique: true });
                }
            };
        });
    }

    /**
     * Cria nova versão de um formulário
     * @param {string} formId - ID do formulário
     * @param {object} schema - Schema do formulário
     * @param {object} metadata - Metadados da versão
     * @returns {Promise<object>} - Versão criada
     */
    async createVersion(formId, schema, metadata = {}) {
        await this.initialize();

        // Obter última versão
        const lastVersion = await this.getLatestVersion(formId);
        
        // Calcular nova versão
        const newVersionNumber = this.calculateNextVersion(
            lastVersion ? lastVersion.version : '0.0.0',
            metadata.breaking
        );

        // Detectar mudanças
        const changes = lastVersion 
            ? this.detectChanges(lastVersion.schema, schema)
            : { type: 'initial', changes: [] };

        // Validar breaking changes
        if (this.options.breakingChangeDetection) {
            const breakingChanges = this.detectBreakingChanges(changes.changes);
            
            if (breakingChanges.length > 0 && !metadata.breaking) {
                console.warn('⚠️ Breaking changes detectados:', breakingChanges);
                
                if (!metadata.forceCreate) {
                    throw new Error(
                        `Breaking changes detectados. Especifique "breaking: true" ou "forceCreate: true".\n` +
                        `Mudanças: ${breakingChanges.map(c => c.description).join(', ')}`
                    );
                }
            }
        }

        // Criar versão
        const version = {
            formId,
            version: newVersionNumber,
            schema: this.deepClone(schema),
            metadata: {
                ...metadata,
                breaking: metadata.breaking || false,
                changelog: metadata.changelog || 'Sem descrição',
                author: metadata.author || 'system',
                createdAt: new Date().toISOString()
            },
            changes: changes.changes,
            previousVersion: lastVersion ? lastVersion.version : null,
            checksum: this.generateChecksum(schema)
        };

        // Salvar versão
        await this.saveVersion(version);

        // Salvar diff se houver versão anterior
        if (lastVersion) {
            await this.saveDiff(formId, lastVersion.version, newVersionNumber, changes.changes);
        }

        console.log(`✅ Versão ${newVersionNumber} criada para formulário ${formId}`);
        
        eventBus.emit('formVersion:created', {
            formId,
            version: newVersionNumber,
            breaking: version.metadata.breaking
        });

        return version;
    }

    /**
     * Calcula próxima versão (semver)
     * @param {string} currentVersion - Versão atual (ex: "1.2.3")
     * @param {boolean} breaking - Se é breaking change
     * @returns {string} - Nova versão
     */
    calculateNextVersion(currentVersion, breaking = false) {
        const [major, minor, patch] = currentVersion.split('.').map(Number);

        if (breaking) {
            // Breaking change: incrementa major
            return `${major + 1}.0.0`;
        }

        // Non-breaking: incrementa minor
        return `${major}.${minor + 1}.0`;
    }

    /**
     * Detecta mudanças entre dois schemas
     * @param {object} oldSchema - Schema antigo
     * @param {object} newSchema - Schema novo
     * @returns {object} - Mudanças detectadas
     */
    detectChanges(oldSchema, newSchema) {
        const changes = [];

        // Comparar campos
        const oldFields = this.extractFields(oldSchema);
        const newFields = this.extractFields(newSchema);

        const oldFieldIds = new Set(oldFields.map(f => f.id));
        const newFieldIds = new Set(newFields.map(f => f.id));

        // Campos removidos
        for (const field of oldFields) {
            if (!newFieldIds.has(field.id)) {
                changes.push({
                    type: 'field_removed',
                    fieldId: field.id,
                    fieldType: field.type,
                    breaking: true,
                    description: `Campo "${field.label || field.id}" foi removido`
                });
            }
        }

        // Campos adicionados
        for (const field of newFields) {
            if (!oldFieldIds.has(field.id)) {
                changes.push({
                    type: 'field_added',
                    fieldId: field.id,
                    fieldType: field.type,
                    breaking: false,
                    description: `Campo "${field.label || field.id}" foi adicionado`
                });
            }
        }

        // Campos modificados
        for (const newField of newFields) {
            if (oldFieldIds.has(newField.id)) {
                const oldField = oldFields.find(f => f.id === newField.id);
                const fieldChanges = this.compareFields(oldField, newField);
                
                changes.push(...fieldChanges);
            }
        }

        // Mudanças em metadados
        const metadataChanges = this.compareMetadata(oldSchema, newSchema);
        changes.push(...metadataChanges);

        return {
            type: changes.length > 0 ? 'modified' : 'unchanged',
            changes
        };
    }

    /**
     * Compara dois campos
     * @param {object} oldField - Campo antigo
     * @param {object} newField - Campo novo
     * @returns {array} - Lista de mudanças
     */
    compareFields(oldField, newField) {
        const changes = [];

        // Tipo mudou
        if (oldField.type !== newField.type) {
            changes.push({
                type: 'field_type_changed',
                fieldId: oldField.id,
                oldType: oldField.type,
                newType: newField.type,
                breaking: true,
                description: `Tipo do campo "${oldField.label || oldField.id}" mudou de ${oldField.type} para ${newField.type}`
            });
        }

        // Required mudou
        if (oldField.required !== newField.required) {
            changes.push({
                type: 'field_required_changed',
                fieldId: oldField.id,
                oldRequired: oldField.required,
                newRequired: newField.required,
                breaking: newField.required === true, // Tornar required é breaking
                description: `Campo "${oldField.label || oldField.id}" agora é ${newField.required ? 'obrigatório' : 'opcional'}`
            });
        }

        // Validação mudou
        if (JSON.stringify(oldField.validation) !== JSON.stringify(newField.validation)) {
            const moreRestrictive = this.isMoreRestrictive(oldField.validation, newField.validation);
            
            changes.push({
                type: 'field_validation_changed',
                fieldId: oldField.id,
                oldValidation: oldField.validation,
                newValidation: newField.validation,
                breaking: moreRestrictive,
                description: `Validação do campo "${oldField.label || oldField.id}" foi ${moreRestrictive ? 'restringida' : 'alterada'}`
            });
        }

        // Label mudou (não breaking)
        if (oldField.label !== newField.label) {
            changes.push({
                type: 'field_label_changed',
                fieldId: oldField.id,
                oldLabel: oldField.label,
                newLabel: newField.label,
                breaking: false,
                description: `Label do campo mudou de "${oldField.label}" para "${newField.label}"`
            });
        }

        return changes;
    }

    /**
     * Compara metadados do formulário
     */
    compareMetadata(oldSchema, newSchema) {
        const changes = [];

        if (oldSchema.title !== newSchema.title) {
            changes.push({
                type: 'metadata_title_changed',
                oldValue: oldSchema.title,
                newValue: newSchema.title,
                breaking: false,
                description: `Título do formulário mudou`
            });
        }

        if (oldSchema.description !== newSchema.description) {
            changes.push({
                type: 'metadata_description_changed',
                oldValue: oldSchema.description,
                newValue: newSchema.description,
                breaking: false,
                description: `Descrição do formulário mudou`
            });
        }

        return changes;
    }

    /**
     * Detecta breaking changes
     * @param {array} changes - Lista de mudanças
     * @returns {array} - Breaking changes
     */
    detectBreakingChanges(changes) {
        return changes.filter(change => change.breaking === true);
    }

    /**
     * Verifica se validação ficou mais restritiva
     */
    isMoreRestrictive(oldValidation = {}, newValidation = {}) {
        // Min aumentou
        if (newValidation.min > (oldValidation.min || 0)) return true;
        
        // Max diminuiu
        if (newValidation.max < (oldValidation.max || Infinity)) return true;
        
        // MinLength aumentou
        if (newValidation.minLength > (oldValidation.minLength || 0)) return true;
        
        // MaxLength diminuiu
        if (newValidation.maxLength < (oldValidation.maxLength || Infinity)) return true;
        
        // Pattern mudou (assume mais restritivo)
        if (newValidation.pattern && newValidation.pattern !== oldValidation.pattern) return true;

        return false;
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
     * Gera checksum do schema
     */
    generateChecksum(schema) {
        const str = JSON.stringify(schema, Object.keys(schema).sort());
        let hash = 0;
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        
        return hash.toString(36);
    }

    /**
     * Obtém última versão de um formulário
     */
    async getLatestVersion(formId) {
        await this.initialize();
        return this.getLatestVersionFromIndexedDB(formId);
    }

    /**
     * Obtém versão específica
     */
    async getVersion(formId, version) {
        await this.initialize();
        return this.getVersionFromIndexedDB(formId, version);
    }

    /**
     * Lista todas as versões de um formulário
     */
    async listVersions(formId) {
        await this.initialize();
        return this.listVersionsFromIndexedDB(formId);
    }

    /**
     * Obtém diff entre duas versões
     */
    async getDiff(formId, fromVersion, toVersion) {
        await this.initialize();
        return this.getDiffFromIndexedDB(formId, fromVersion, toVersion);
    }

    /**
     * Salva versão no storage
     */
    async saveVersion(version) {
        return this.saveVersionToIndexedDB(version);
    }

    /**
     * Salva diff no storage
     */
    async saveDiff(formId, fromVersion, toVersion, changes) {
        const diff = {
            formId,
            fromVersion,
            toVersion,
            changes,
            createdAt: new Date().toISOString()
        };
        return this.saveDiffToIndexedDB(diff);
    }

    // ========== IndexedDB Methods ==========

    async getLatestVersionFromIndexedDB(formId) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['versions'], 'readonly');
            const store = tx.objectStore('versions');
            const index = store.index('formId');
            const request = index.getAll(formId);

            request.onsuccess = () => {
                const versions = request.result;
                
                if (versions.length === 0) {
                    resolve(null);
                } else {
                    // Ordenar por versão (semver)
                    versions.sort((a, b) => this.compareVersions(b.version, a.version));
                    resolve(versions[0]);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    async getVersionFromIndexedDB(formId, version) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['versions'], 'readonly');
            const store = tx.objectStore('versions');
            const index = store.index('version');
            const request = index.get([formId, version]);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async listVersionsFromIndexedDB(formId) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['versions'], 'readonly');
            const store = tx.objectStore('versions');
            const index = store.index('formId');
            const request = index.getAll(formId);

            request.onsuccess = () => {
                const versions = request.result;
                versions.sort((a, b) => this.compareVersions(b.version, a.version));
                resolve(versions);
            };

            request.onerror = () => reject(request.error);
        });
    }

    async saveVersionToIndexedDB(version) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['versions'], 'readwrite');
            const store = tx.objectStore('versions');
            const request = store.add(version);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getDiffFromIndexedDB(formId, fromVersion, toVersion) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['diffs'], 'readonly');
            const store = tx.objectStore('diffs');
            const index = store.index('versions');
            const request = index.get([formId, fromVersion, toVersion]);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async saveDiffToIndexedDB(diff) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['diffs'], 'readwrite');
            const store = tx.objectStore('diffs');
            const request = store.add(diff);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ========== Utility Methods ==========

    /**
     * Compara duas versões semver
     * @returns {number} - -1 se a < b, 0 se a === b, 1 se a > b
     */
    compareVersions(a, b) {
        const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
        const [bMajor, bMinor, bPatch] = b.split('.').map(Number);

        if (aMajor !== bMajor) return aMajor - bMajor;
        if (aMinor !== bMinor) return aMinor - bMinor;
        return aPatch - bPatch;
    }

    /**
     * Deep clone de objeto
     */
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /**
     * Destrói o gerenciador
     */
    destroy() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        
        this.initialized = false;
    }
}

export default FormVersionManager;
