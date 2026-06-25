/**
 * VersionedFormRenderer - Renderiza formulários mantendo compatibilidade com versões antigas
 * 
 * Permite visualizar dados coletados em versões antigas do formulário
 * usando o schema original, sem forçar a estrutura nova.
 * 
 * Features:
 * - Renderização com schema da versão específica
 * - Modo de visualização read-only para dados antigos
 * - Opção de migração inline com preview
 * - Comparação lado a lado (versão antiga vs nova)
 * - Warnings para campos obsoletos/removidos
 * 
 * @example
 * const renderer = new VersionedFormRenderer();
 * 
 * // Renderizar com versão específica
 * await renderer.render(data, {
 *   schemaVersion: '1.0.0',
 *   mode: 'readonly' // ou 'edit', 'migrate'
 * });
 */

import { eventBus } from './EventEmitter.js';
import { FormVersionManager } from './FormVersionManager.js';
import { FormMigrationEngine } from './FormMigrationEngine.js';

export class VersionedFormRenderer {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            versionManager: null,
            migrationEngine: null,
            showVersionWarning: true,
            allowInlineMigration: true,
            highlightObsoleteFields: true,
            ...options
        };

        this.versionManager = this.options.versionManager || new FormVersionManager();
        this.migrationEngine = this.options.migrationEngine || new FormMigrationEngine();
        
        this.currentSchema = null;
        this.currentVersion = null;
        this.latestVersion = null;
    }

    /**
     * Renderiza formulário com dados versionados
     * @param {object} data - Dados do formulário
     * @param {object} options - Opções de renderização
     */
    async render(data, options = {}) {
        const formId = data.formId || options.formId;
        const dataVersion = data._schema_version || options.schemaVersion || '1.0.0';
        const mode = options.mode || 'readonly'; // readonly, edit, migrate

        console.log(`🎨 Renderizando formulário ${formId} versão ${dataVersion} (modo: ${mode})`);

        // Obter schema da versão dos dados
        const schema = await this.versionManager.getVersion(formId, dataVersion);
        
        if (!schema) {
            throw new Error(`Schema versão ${dataVersion} não encontrado para formulário ${formId}`);
        }

        this.currentSchema = schema.schema;
        this.currentVersion = dataVersion;

        // Obter última versão disponível
        const latestVersion = await this.versionManager.getLatestVersion(formId);
        this.latestVersion = latestVersion ? latestVersion.version : dataVersion;

        // Limpar container
        this.container.innerHTML = '';

        // Renderizar warning se não for última versão
        if (this.options.showVersionWarning && dataVersion !== this.latestVersion) {
            this.renderVersionWarning(dataVersion, this.latestVersion, schema.metadata);
        }

        // Renderizar campos
        await this.renderFields(data, mode);

        // Renderizar controles de migração se aplicável
        if (this.options.allowInlineMigration && mode !== 'migrate' && dataVersion !== this.latestVersion) {
            this.renderMigrationControls(data, dataVersion, this.latestVersion);
        }

        eventBus.emit('versionedForm:rendered', {
            formId,
            version: dataVersion,
            mode
        });
    }

    /**
     * Renderiza warning de versão desatualizada
     */
    renderVersionWarning(currentVersion, latestVersion, metadata) {
        const warning = document.createElement('div');
        warning.className = 'version-warning bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4';
        
        const isBreaking = metadata?.breaking || false;
        const breakingClass = isBreaking ? 'text-red-700' : 'text-yellow-700';
        const breakingIcon = isBreaking ? '🔴' : '⚠️';

        warning.innerHTML = `
            <div class="flex">
                <div class="flex-shrink-0">
                    <span class="text-2xl">${breakingIcon}</span>
                </div>
                <div class="ml-3 flex-1">
                    <p class="text-sm ${breakingClass} font-medium">
                        ${isBreaking ? 'Breaking Change Detectado' : 'Versão Desatualizada'}
                    </p>
                    <p class="mt-2 text-sm text-yellow-700">
                        Estes dados foram coletados com a versão <strong>${currentVersion}</strong> do formulário.
                        A versão atual é <strong>${latestVersion}</strong>.
                    </p>
                    ${isBreaking ? `
                        <p class="mt-1 text-sm text-red-600">
                            <strong>Atenção:</strong> A nova versão contém mudanças incompatíveis (breaking changes).
                            Recomendamos revisar os dados após migração.
                        </p>
                    ` : ''}
                    <p class="mt-2 text-sm text-yellow-700">
                        Você está visualizando os dados com o schema original para garantir compatibilidade.
                    </p>
                </div>
            </div>
        `;

        this.container.appendChild(warning);
    }

    /**
     * Renderiza controles de migração
     */
    renderMigrationControls(data, fromVersion, toVersion) {
        const controls = document.createElement('div');
        controls.className = 'migration-controls bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4';

        controls.innerHTML = `
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-sm font-medium text-blue-900">Migração Disponível</h3>
                    <p class="mt-1 text-sm text-blue-700">
                        Migrar dados de <strong>${fromVersion}</strong> para <strong>${toVersion}</strong>
                    </p>
                </div>
                <div class="flex gap-2">
                    <button id="preview-migration-btn" 
                            class="bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded text-sm font-medium">
                        👁️ Preview
                    </button>
                    <button id="apply-migration-btn" 
                            class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium">
                        🔄 Migrar Agora
                    </button>
                </div>
            </div>
            <div id="migration-preview" class="hidden mt-4"></div>
        `;

        this.container.appendChild(controls);

        // Event listeners
        const previewBtn = controls.querySelector('#preview-migration-btn');
        const applyBtn = controls.querySelector('#apply-migration-btn');
        const previewContainer = controls.querySelector('#migration-preview');

        previewBtn.addEventListener('click', async () => {
            await this.showMigrationPreview(data, fromVersion, toVersion, previewContainer);
        });

        applyBtn.addEventListener('click', async () => {
            await this.applyMigration(data, fromVersion, toVersion);
        });
    }

    /**
     * Mostra preview da migração
     */
    async showMigrationPreview(data, fromVersion, toVersion, container) {
        container.classList.remove('hidden');
        container.innerHTML = '<p class="text-sm text-gray-600">Calculando preview...</p>';

        try {
            // Obter schemas
            const oldSchema = await this.versionManager.getVersion(data.formId, fromVersion);
            const newSchema = await this.versionManager.getVersion(data.formId, toVersion);

            // Simular migração
            const migratedData = await this.migrationEngine.migrate(
                data,
                fromVersion,
                toVersion,
                oldSchema.schema,
                newSchema.schema
            );

            // Obter diff
            const diff = await this.versionManager.getDiff(data.formId, fromVersion, toVersion);

            // Renderizar comparação
            container.innerHTML = this.renderMigrationDiff(data, migratedData, diff?.changes || []);

        } catch (error) {
            container.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded p-3">
                    <p class="text-sm text-red-700">
                        <strong>Erro:</strong> ${error.message}
                    </p>
                </div>
            `;
        }
    }

    /**
     * Renderiza diff da migração
     */
    renderMigrationDiff(oldData, newData, changes) {
        const breakingChanges = changes.filter(c => c.breaking);
        
        let html = `
            <div class="border-t border-blue-200 pt-4">
                <h4 class="text-sm font-medium text-blue-900 mb-3">Preview da Migração</h4>
                
                ${breakingChanges.length > 0 ? `
                    <div class="bg-red-50 border border-red-200 rounded p-3 mb-3">
                        <p class="text-sm font-medium text-red-900">⚠️ Breaking Changes (${breakingChanges.length})</p>
                        <ul class="mt-2 text-sm text-red-700 list-disc list-inside">
                            ${breakingChanges.map(c => `<li>${c.description}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <h5 class="text-xs font-medium text-gray-700 mb-2">Dados Atuais (${oldData._schema_version})</h5>
                        <pre class="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-64">${JSON.stringify(oldData, null, 2)}</pre>
                    </div>
                    <div>
                        <h5 class="text-xs font-medium text-gray-700 mb-2">Após Migração (${newData._schema_version})</h5>
                        <pre class="bg-green-50 p-2 rounded text-xs overflow-auto max-h-64">${JSON.stringify(newData, null, 2)}</pre>
                    </div>
                </div>
                
                <div class="mt-3">
                    <p class="text-xs text-gray-600">
                        <strong>Mudanças:</strong> ${changes.length} detectada(s)
                    </p>
                </div>
            </div>
        `;

        return html;
    }

    /**
     * Aplica migração
     */
    async applyMigration(data, fromVersion, toVersion) {
        if (!confirm(`Tem certeza que deseja migrar este registro de ${fromVersion} para ${toVersion}?`)) {
            return;
        }

        try {
            const oldSchema = await this.versionManager.getVersion(data.formId, fromVersion);
            const newSchema = await this.versionManager.getVersion(data.formId, toVersion);

            const migratedData = await this.migrationEngine.migrate(
                data,
                fromVersion,
                toVersion,
                oldSchema.schema,
                newSchema.schema
            );

            // TODO: Salvar dados migrados no IndexedDB/Supabase
            console.log('✅ Migração aplicada:', migratedData);

            eventBus.emit('versionedForm:migrated', {
                formId: data.formId,
                fromVersion,
                toVersion,
                recordId: data.id
            });

            // Recarregar com nova versão
            await this.render(migratedData, {
                formId: data.formId,
                mode: 'edit'
            });

            alert('Migração aplicada com sucesso!');

        } catch (error) {
            console.error('❌ Erro na migração:', error);
            alert(`Erro na migração: ${error.message}`);
        }
    }

    /**
     * Renderiza campos do formulário
     */
    async renderFields(data, mode) {
        const form = document.createElement('form');
        form.className = 'versioned-form space-y-4';

        const fields = this.extractFields(this.currentSchema);

        for (const field of fields) {
            const fieldContainer = this.renderField(field, data[field.id], mode);
            form.appendChild(fieldContainer);
        }

        this.container.appendChild(form);
    }

    /**
     * Renderiza um campo
     */
    renderField(field, value, mode) {
        const container = document.createElement('div');
        container.className = 'field-container';

        const isReadonly = mode === 'readonly';
        const isObsolete = this.isFieldObsolete(field.id);

        if (isObsolete && this.options.highlightObsoleteFields) {
            container.className += ' bg-gray-50 border-l-4 border-gray-400 pl-4';
        }

        let inputHtml = '';

        switch (field.type) {
            case 'text':
            case 'email':
            case 'tel':
                inputHtml = `
                    <input type="${field.type}" 
                           id="${field.id}" 
                           name="${field.id}"
                           value="${value || ''}"
                           ${isReadonly ? 'readonly' : ''}
                           class="w-full border border-gray-300 rounded px-3 py-2 ${isReadonly ? 'bg-gray-50' : ''}">
                `;
                break;

            case 'number':
                inputHtml = `
                    <input type="number" 
                           id="${field.id}" 
                           name="${field.id}"
                           value="${value || ''}"
                           ${isReadonly ? 'readonly' : ''}
                           class="w-full border border-gray-300 rounded px-3 py-2 ${isReadonly ? 'bg-gray-50' : ''}">
                `;
                break;

            case 'textarea':
                inputHtml = `
                    <textarea id="${field.id}" 
                              name="${field.id}"
                              ${isReadonly ? 'readonly' : ''}
                              class="w-full border border-gray-300 rounded px-3 py-2 ${isReadonly ? 'bg-gray-50' : ''}"
                              rows="3">${value || ''}</textarea>
                `;
                break;

            case 'checkbox':
                inputHtml = `
                    <label class="flex items-center">
                        <input type="checkbox" 
                               id="${field.id}" 
                               name="${field.id}"
                               ${value ? 'checked' : ''}
                               ${isReadonly ? 'disabled' : ''}
                               class="mr-2">
                        <span>${field.label}</span>
                    </label>
                `;
                break;

            default:
                inputHtml = `
                    <input type="text" 
                           id="${field.id}" 
                           name="${field.id}"
                           value="${value || ''}"
                           ${isReadonly ? 'readonly' : ''}
                           class="w-full border border-gray-300 rounded px-3 py-2 ${isReadonly ? 'bg-gray-50' : ''}">
                `;
        }

        container.innerHTML = `
            <label class="block text-sm font-medium text-gray-700 mb-1">
                ${field.label}
                ${field.required ? '<span class="text-red-500">*</span>' : ''}
                ${isObsolete ? '<span class="text-gray-500 text-xs ml-2">(Campo obsoleto)</span>' : ''}
            </label>
            ${inputHtml}
            ${isObsolete ? `
                <p class="text-xs text-gray-500 mt-1">
                    Este campo não existe mais na versão atual do formulário.
                </p>
            ` : ''}
        `;

        return container;
    }

    /**
     * Verifica se campo é obsoleto (não existe na versão mais recente)
     */
    isFieldObsolete(fieldId) {
        // TODO: Implementar lógica real comparando com schema mais recente
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
     * Destrói o renderizador
     */
    destroy() {
        this.container.innerHTML = '';
        this.currentSchema = null;
        this.currentVersion = null;
        this.latestVersion = null;
    }
}

export default VersionedFormRenderer;
