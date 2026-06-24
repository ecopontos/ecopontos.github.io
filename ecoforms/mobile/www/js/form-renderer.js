/**
 * Form Renderer - Sistema de renderização de formulários com dados do Supabase Storage
 * Integrado com SmartCache para performance otimizada
 */

import { computeDefaultValue } from './fields/defaults.js';

function getBrazilNow() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(now).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
    }, {});

    return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hours: parts.hour,
        minutes: parts.minute,
        seconds: parts.second
    };
}

class FormRenderer {
    constructor() {
        this.smartCache = null;
        this.dataService = null;
        this.loadedForms = new Map();
        this.isInitialized = false;
        this.fallbackMode = false;
        this.lastSuccessfulSync = null;
        this.connectivityCheckInterval = null;
        this.defaultToNowInterval = null; // Timer global para defaultToNow
    }

    /**
     * Inicializa o FormRenderer
     */
    async init() {
        try {
            // Inicializar SmartCache
            this.smartCache = new SmartCacheService();
            await this.smartCache.initSupabase();

            // Inicializar DataService se disponível
            if (typeof DataService !== 'undefined') {
                this.dataService = new DataService();
                if (window.supabaseConfig) {
                    this.dataService.configureSupabase(
                        window.supabaseConfig.url,
                        window.supabaseConfig.key
                    );
                }
            }

            // Iniciar monitoramento de conectividade
            this.startConnectivityMonitoring();

            this.isInitialized = true;
            console.log('✅ FormRenderer inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro ao inicializar FormRenderer:', error);
            throw error;
        }
    }

    /**
     * Carrega e renderiza um formulário no container especificado
     */
    async loadForm(formId, containerId) {
        try {
            if (!this.isInitialized) {
                await this.init();
            }

            console.log(`🔄 Carregando formulário: ${formId}`);

            // Buscar configuração do formulário do Storage
            const formConfig = await this.smartCache.loadForm(formId);

            if (!formConfig) {
                throw new Error(`Formulário '${formId}' não encontrado`);
            }

            // Marcar como sincronização bem-sucedida
            this.lastSuccessfulSync = new Date().toISOString();
            this.fallbackMode = false;

            // Carregar dados necessários para os campos
            const enrichedConfig = await this.enrichFormWithData(formConfig);

            // Renderizar o formulário
            await this.renderForm(enrichedConfig, containerId);

            // Salvar na cache de formulários carregados
            this.loadedForms.set(formId, {
                config: enrichedConfig,
                containerId: containerId,
                loadedAt: new Date(),
                fallbackMode: false
            });

            console.log(`✅ Formulário '${formId}' carregado com sucesso`);
            return true;

        } catch (error) {
            console.warn(`⚠️ Falha no carregamento normal: ${error.message}`);

            // Tentar fallback com dados expirados
            return await this.loadFormWithFallback(formId, containerId, error);
        }
    }

    /**
     * Carregamento com fallback para dados expirados
     */
    async loadFormWithFallback(formId, containerId, originalError) {
        try {
            console.log(`🔄 Tentando fallback para formulário: ${formId}`);

            // Buscar dados mesmo se expirados
            const cachedForm = this.smartCache.getCachedData(`forms_${formId}`, true);

            if (!cachedForm) {
                throw originalError; // Não tem nem cache antigo
            }

            console.log(`⚠️ MODO FALLBACK: Usando dados expirados para '${formId}'`);
            this.fallbackMode = true;

            // Tentar carregar dados para os campos (também com fallback)
            const enrichedConfig = await this.enrichFormWithFallback(cachedForm);

            // Renderizar com aviso de modo offline
            await this.renderFormWithWarning(enrichedConfig, containerId);

            // Salvar na cache de formulários carregados
            this.loadedForms.set(formId, {
                config: enrichedConfig,
                containerId: containerId,
                loadedAt: new Date(),
                fallbackMode: true
            });

            console.log(`✅ Formulário '${formId}' carregado em MODO FALLBACK`);
            return true;

        } catch (fallbackError) {
            console.error(`❌ Fallback também falhou:`, fallbackError);
            if (typeof this.showError === 'function') {
                this.showError(containerId, `Sistema offline e sem dados em cache para '${formId}'`);
            } else {
                // fallback global
                window.FormRenderer.prototype.showError.call(this, containerId, `Sistema offline e sem dados em cache para '${formId}'`);
            }
            return false;
        }
    }

    /**
     * Enrichment com fallback para dados de campos
     */
    async enrichFormWithFallback(formConfig) {
        const enrichedConfig = JSON.parse(JSON.stringify(formConfig));

        if (!enrichedConfig.campos) {
            return enrichedConfig;
        }

        console.log(`📊 Carregando dados com fallback para ${enrichedConfig.campos.length} campos...`);

        for (const campo of enrichedConfig.campos) {
            if (campo.dataSource) {
                try {
                    // Tentar carregamento normal
                    const data = await this.smartCache.loadDataSource(campo.dataSource);
                    campo._loadedData = data;
                    campo._dataLoadedAt = new Date().toISOString();

                } catch (error) {
                    // Fallback para dados expirados
                    console.warn(`⚠️ Tentando fallback para dados de '${campo.id}'`);

                    const cachedData = this.smartCache.getCachedData(`data_${campo.dataSource}`, true);

                    if (cachedData) {
                        campo._loadedData = cachedData;
                        campo._dataLoadedAt = 'DADOS EXPIRADOS';
                        campo._fallbackMode = true;
                        console.log(`⚠️ Usando dados expirados para '${campo.id}'`);
                    } else {
                        campo._loadedData = [];
                        campo._loadError = `Sem conexão e sem cache para '${campo.dataSource}'`;
                        console.error(`❌ Nenhum dado disponível para '${campo.id}'`);
                    }
                }
            }
        }

        return enrichedConfig;
    }

    /**
     * Enriquece a configuração do formulário carregando dados dos campos
     */
    async enrichFormWithData(formConfig) {
        const enrichedConfig = JSON.parse(JSON.stringify(formConfig)); // Deep copy

        if (!enrichedConfig.campos) {
            return enrichedConfig;
        }

        console.log(`📊 Carregando dados para ${enrichedConfig.campos.length} campos...`);

        // Processar campos em paralelo para melhor performance
        const enrichPromises = enrichedConfig.campos.map(async (campo) => {
            if (campo.dataSource) {
                try {
                    console.log(`📥 Carregando dados para campo '${campo.id}' de '${campo.dataSource}'`);
                    const data = await this.smartCache.loadDataSource(campo.dataSource);

                    // Adicionar dados carregados ao campo
                    campo._loadedData = data;
                    campo._dataLoadedAt = new Date().toISOString();

                    console.log(`✅ Dados carregados para '${campo.id}': ${Array.isArray(data) ? data.length : 0} itens`);
                } catch (error) {
                    console.warn(`⚠️ Erro ao carregar dados para campo '${campo.id}':`, error);
                    campo._loadedData = [];
                    campo._loadError = error.message;
                }
            }
            return campo;
        });

        // Aguardar todos os campos serem processados
        await Promise.all(enrichPromises);

        console.log(`✅ Dados carregados para todos os campos`);
        return enrichedConfig;
    }

    /**
     * Renderiza o formulário no DOM
     */
    async renderForm(formConfig, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container '${containerId}' não encontrado`);
        }

        // Limpar container
        container.innerHTML = '';

        // Gerar HTML do formulário
        const formHtml = this.generateFormHTML(formConfig);
        container.innerHTML = formHtml;

        // Aplicar handlers e funcionalidades
        await this.applyFormHandlers(formConfig, containerId);

        console.log(`✅ Formulário renderizado em '${containerId}'`);
    }

    /**
     * Renderiza formulário com aviso de modo offline
     */
    async renderFormWithWarning(formConfig, containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Container '${containerId}' não encontrado`);
        }

        // Gerar HTML com banner de aviso
        const warningBanner = `
            <div class="alert alert-warning offline-warning" style="
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                color: #856404;
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 20px;
            ">
                <h4 style="margin: 0 0 10px 0;">⚠️ Modo Offline Detectado</h4>
                <p style="margin: 0 0 10px 0;">Usando dados em cache. Alguns campos podem estar desatualizados.</p>
                <small style="display: block; margin-bottom: 10px;">
                    Última sincronização bem-sucedida: ${this.lastSuccessfulSync || 'Desconhecida'}
                </small>
                <button onclick="location.reload()" class="btn btn-sm" style="
                    background: #007bff;
                    color: white;
                    border: none;
                    padding: 5px 15px;
                    border-radius: 3px;
                    cursor: pointer;
                ">Tentar Reconectar</button>
            </div>
        `;

        const formHtml = this.generateFormHTML(formConfig);
        container.innerHTML = warningBanner + formHtml;

        // Aplicar handlers
        await this.applyFormHandlers(formConfig, containerId);

        console.log(`✅ Formulário renderizado com AVISO DE OFFLINE`);
    }

    /**
     * Gera o HTML do formulário
     */
    generateFormHTML(formConfig) {
        let html = `
            <form id="form-${formConfig.id}" class="dynamic-form" data-form-id="${formConfig.id}">
                <div class="form-header">
                    <h2 class="form-title">${formConfig.titulo || formConfig.title || 'Formulário'}</h2>
                    ${formConfig.descricao ? `<p class="form-description">${formConfig.descricao}</p>` : ''}
                </div>
                <div class="form-body">
        `;

        // Renderizar campos
        if (formConfig.campos) {
            for (const campo of formConfig.campos) {
                html += this.generateFieldHTML(campo);
            }
        }

        html += `
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">
                        <i class="icon-save"></i> Salvar
                    </button>
                    <button type="button" class="btn btn-secondary" onclick="history.back()">
                        <i class="icon-back"></i> Cancelar
                    </button>
                </div>
            </form>
        `;

        return html;
    }

    /**
     * Gera HTML para um campo específico
     */
    generateFieldHTML(campo) {
        const fieldId = `field-${campo.id}`;
        const required = campo.required ? 'required' : '';
        const readonly = campo.readonly ? 'readonly' : '';

        // Tratamento para campos hidden
        if (campo.type === 'hidden') {
            const value = campo.value || campo.defaultValue || '';
            return `<input type="hidden" id="${campo.id}" name="${campo.id}" value="${this.escapeHtml(value)}" />`;
        }

        let html = `
            <div class="form-group" data-field="${campo.id}">
                <label for="${campo.id}" class="form-label">
                    ${this.escapeHtml(campo.label)}
                    ${campo.required ? '<span class="required">*</span>' : ''}
                </label>
        `;

        if (campo.descricao) {
            html += `<small class="form-help">${this.escapeHtml(campo.descricao)}</small>`;
        }

        switch (campo.type) {
            case 'select':
                html += this.generateSelectField(campo);
                break;
            case 'textarea':
                html += `
                    <textarea 
                        id="${campo.id}" 
                        name="${campo.id}" 
                        class="form-control"
                        ${required} 
                        ${readonly}
                        ${campo.placeholder ? `placeholder="${this.escapeHtml(campo.placeholder)}"` : ''}
                    ></textarea>
                `;
                break;
            case 'date':
                const dateValue = campo.defaultToNow ? computeDefaultValue(campo) : '';
                html += `
                    <input 
                        type="date" 
                        id="${campo.id}" 
                        name="${campo.id}" 
                        class="form-control"
                        value="${this.escapeHtml(dateValue)}"
                        ${required} 
                        ${readonly}
                        ${campo.defaultToNow ? `data-default-to-now="true" oninput="this.dataset.modified='true'"` : ''}
                    />
                `;
                break;
            case 'time':
                let timeValue = '';
                if (typeof campo.value === 'string' && campo.value) {
                    timeValue = campo.value;
                } else if (campo.defaultToNow) {
                    timeValue = computeDefaultValue(campo);
                }
                html += `
                    <input 
                        type="time" 
                        id="${campo.id}" 
                        name="${campo.id}" 
                        class="form-control"
                        value="${this.escapeHtml(timeValue)}"
                        ${required} 
                        ${readonly}
                        ${campo.defaultToNow ? `data-default-to-now="true" oninput="this.dataset.modified='true'"` : ''}
                    />
                `;
                break;
            case 'datetime-local':
            case 'datetime':
                const datetimeValue = campo.defaultToNow ? computeDefaultValue(campo) : '';
                html += `
                    <input 
                        type="datetime-local" 
                        id="${campo.id}" 
                        name="${campo.id}" 
                        class="form-control"
                        value="${this.escapeHtml(datetimeValue)}"
                        ${required} 
                        ${readonly}
                        ${campo.defaultToNow ? `data-default-to-now="true" oninput="this.dataset.modified='true'"` : ''}
                    />
                `;
                break;
            default:
                html += `
                    <input 
                        type="${campo.type || 'text'}" 
                        id="${campo.id}" 
                        name="${campo.id}" 
                        class="form-control"
                        ${required} 
                        ${readonly}
                        ${campo.placeholder ? `placeholder="${this.escapeHtml(campo.placeholder)}"` : ''}
                        ${campo.uppercase ? 'style="text-transform: uppercase"' : ''}
                        ${campo.validation?.pattern ? `pattern="${this.escapeHtml(campo.validation.pattern)}"` : ''}
                    />
                `;
        }

        // Mostrar informações de debug sobre dados carregados
        if (campo._loadedData && campo.dataSource) {
            const dataCount = Array.isArray(campo._loadedData) ? campo._loadedData.length : 'N/A';

            if (campo._fallbackMode) {
                html += `<small class="text-warning" style="display: block; margin-top: 5px;">
                    ⚠️ Dados offline: ${dataCount} itens de '${this.escapeHtml(campo.dataSource)}' (${this.escapeHtml(campo._dataLoadedAt)})
                </small>`;
            } else {
                html += `<small class="text-muted" style="display: block; margin-top: 5px;">
                    ✅ Dados carregados: ${dataCount} itens de '${this.escapeHtml(campo.dataSource)}'
                </small>`;
            }
        }

        if (campo._loadError) {
            html += `<small class="text-danger" style="display: block; margin-top: 5px;">
                ❌ ${this.escapeHtml(campo._loadError)}
            </small>`;
        }

        html += '</div>';
        return html;
    }

    /**
     * Escapa HTML para prevenir XSS
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Gera campo select com dados carregados
     */
    generateSelectField(campo) {
        const multipleAttr = campo.multiple ? 'multiple' : '';

        let html = `
            <select 
                id="${campo.id}" 
                name="${campo.id}" 
                class="form-control"
                ${multipleAttr}
                ${campo.required ? 'required' : ''}
                ${campo.readonly ? 'disabled' : ''}
            >
        `;

        // Opção vazia se permitida
        if (campo.showEmptyOption) {
            const emptyValue = campo.emptyOptionValue || '';
            const emptyLabel = campo.emptyOptionLabel || 'Selecione...';
            html += `<option value="${this.escapeHtml(emptyValue)}">${this.escapeHtml(emptyLabel)}</option>`;
        }

        // Adicionar opções dos dados carregados
        if (campo._loadedData && Array.isArray(campo._loadedData)) {
            let options = campo._loadedData;

            // Ordenar por padrão (ordem alfabética crescente)
            if (campo.sort !== false) {
                options = [...options].sort((a, b) => {
                    const sortField = typeof campo.sort === 'string' ? campo.sort : null;
                    const aVal = sortField ? a[sortField] : (a.label || a.nome || a.name || a.descricao || a);
                    const bVal = sortField ? b[sortField] : (b.label || b.nome || b.name || b.descricao || b);
                    return String(aVal).localeCompare(String(bVal), 'pt-BR', { sensitivity: 'base' });
                });
            }

            for (const option of options) {
                // Usar optionValue e optionLabel se definidos, senão usar lógica padrão
                let value, label;

                if (campo.optionValue) {
                    value = option[campo.optionValue] || option;
                } else {
                    value = option.value || option.id || option.codigo || option;
                }

                if (campo.optionLabel) {
                    label = option[campo.optionLabel] || option;
                } else {
                    label = option.label || option.nome || option.name || option.descricao || option;
                }

                const selectedCandidate = campo.value !== undefined ? campo.value
                    : (campo.defaultValue !== undefined ? campo.defaultValue : (typeof window !== 'undefined' && window.formData ? window.formData[campo.id] : undefined));

                let isSelected = false;
                if (selectedCandidate !== undefined && selectedCandidate !== null) {
                    if (Array.isArray(selectedCandidate)) {
                        isSelected = selectedCandidate.map(item => String(item)).includes(String(value));
                    } else {
                        isSelected = String(value) === String(selectedCandidate);
                    }
                }

                html += `<option value="${this.escapeHtml(String(value))}" ${isSelected ? 'selected' : ''}>${this.escapeHtml(String(label))}</option>`;
            }
        }

        html += '</select>';
        return html;
    }

    /**
     * Aplica handlers e funcionalidades ao formulário
     */
    /**
     * Aplica handlers e funcionalidades ao formulário
     */
    async applyFormHandlers(formConfig, containerId) {
        const form = document.getElementById(`form-${formConfig.id}`);
        if (!form) return;

        // Handler de submit
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.handleFormSubmit(formConfig, form);
        });

        // Aplicar validações
        this.applyValidations(formConfig);

        // Aplicar dependências de campos (Novo)
        this.applyFieldDependencies(formConfig);

        // Aplicar visibilidade condicional
        this.applyVisibilityRules(formConfig, form);

        // Iniciar atualização automática de campos defaultToNow
        this.startDefaultToNowUpdater();

        console.log(`✅ Handlers aplicados ao formulário '${formConfig.id}'`);
    }

    /**
     * Aplica lógica de dependência entre campos
     */
    applyFieldDependencies(formConfig) {
        if (!formConfig.campos) return;

        formConfig.campos.forEach(campo => {
            if (campo.dependency && campo.type === 'select') {
                const parentId = campo.dependency.fieldId;
                const childId = campo.id;
                const parentElement = document.getElementById(parentId);
                const childElement = document.getElementById(childId);

                if (parentElement && childElement) {
                    const updateOptions = () => {
                        const parentValue = parentElement.value;

                        // Se pai vazio, limpa filho (ou mostra vazio)
                        if (!parentValue) {
                            childElement.innerHTML = '<option value="">Selecione primeiro o campo anterior...</option>';
                            childElement.disabled = true;
                            return;
                        }

                        childElement.disabled = campo.readonly || false;

                        // Filtrar opções
                        const filterProp = campo.dependency.filterProperty || parentId;

                        // Usar _loadedData que já está no objeto campo
                        if (campo._loadedData && Array.isArray(campo._loadedData)) {
                            // Filtrar
                            let filteredOptions = campo._loadedData.filter(opt => {
                                // Comparação frouxa (string vs number)
                                return String(opt[filterProp]) == String(parentValue);
                            });

                            // Ordenar por padrão (ordem alfabética crescente)
                            if (campo.sort !== false) {
                                filteredOptions.sort((a, b) => {
                                    const sortField = typeof campo.sort === 'string' ? campo.sort : null;
                                    const aVal = sortField ? a[sortField] : (a.label || a.nome || a.name || a.descricao || a);
                                    const bVal = sortField ? b[sortField] : (b.label || b.nome || b.name || b.descricao || b);
                                    return String(aVal).localeCompare(String(bVal), 'pt-BR', { sensitivity: 'base' });
                                });
                            }

                            // Gerar HTML
                            let html = '';

                            // Opção vazia
                            if (campo.showEmptyOption || true) { // Sempre bom ter opção vazia ao filtrar
                                const emptyLabel = campo.emptyOptionLabel || 'Selecione...';
                                html += `<option value="">${this.escapeHtml(emptyLabel)}</option>`;
                            }

                            for (const option of filteredOptions) {
                                let value, label;
                                if (campo.optionValue) {
                                    value = option[campo.optionValue] || option;
                                } else {
                                    value = option.value || option.id || option.codigo || option;
                                }

                                if (campo.optionLabel) {
                                    label = option[campo.optionLabel] || option;
                                } else {
                                    label = option.label || option.nome || option.name || option.descricao || option;
                                }
                                html += `<option value="${this.escapeHtml(String(value))}">${this.escapeHtml(String(label))}</option>`;
                            }

                            if (filteredOptions.length === 0) {
                                html = '<option value="">Nenhuma opção encontrada</option>';
                            }

                            childElement.innerHTML = html;
                        }
                    };

                    // Ouvir mudanças no pai
                    parentElement.addEventListener('change', () => {
                        // Limpar valor atual do filho
                        childElement.value = '';
                        updateOptions();
                        // Disparar change no filho para propagar cascata (se houver netos)
                        childElement.dispatchEvent(new Event('change'));
                    });

                    // Inicializar estado
                    updateOptions();
                }
            }
        });
    }

    /**
     * Aplica regras de visibilidade e habilitação condicional
     */
    applyVisibilityRules(formConfig, form) {
        if (!formConfig.campos) return;

        // Armazena campos que possuem regras para otimização
        const fieldsWithRules = formConfig.campos.filter(c => 
            (c.visibility && c.visibility.length > 0) || 
            (c.enabled && c.enabled.length > 0)
        );

        if (fieldsWithRules.length === 0) return;

        const evaluateAllRules = () => {
            // Construir formData atual
            const formData = {};
            const htmlData = new FormData(form);
            for (let [key, value] of htmlData.entries()) {
                // Lidar com checkboxes/multiselects (pode ter múltiplos valores)
                const allValues = htmlData.getAll(key);
                formData[key] = allValues.length > 1 ? allValues : value;
            }
            
            // Mesclar com dados do Alpine (se existirem)
            const alpineData = window.formData || {};
            const currentData = { ...alpineData, ...formData };
            
            // Avaliar cada campo com regras
            fieldsWithRules.forEach(campo => {
                // Visibilidade
                if (campo.visibility && campo.visibility.length > 0) {
                    const isVisible = this.evaluateVisibilityRules(campo.visibility, currentData);
                    const container = form.querySelector(`[data-field="${campo.id}"]`);
                    if (container) {
                        container.style.display = isVisible ? '' : 'none';
                    }
                }

                // Habilitação (enabled)
                if (campo.enabled && campo.enabled.length > 0) {
                    const isEnabled = this.evaluateVisibilityRules(campo.enabled, currentData);
                    const inputElement = form.querySelector(`[name="${campo.id}"]`);
                    if (inputElement) {
                        inputElement.disabled = !isEnabled;
                    }
                }
            });
        };

        // Adicionar event listener no form para englobar todas as mudanças
        form.addEventListener('change', evaluateAllRules);
        form.addEventListener('input', evaluateAllRules);

        // Executar a primeira vez para aplicar as regras ao carregar
        evaluateAllRules();
    }

    /**
     * Avalia array de regras de visibilidade
     */
    evaluateVisibilityRules(rules, formData) {
        if (!rules || rules.length === 0) return true;

        return rules.reduce((result, rule, index) => {
            const fieldValue = formData[rule.fieldId];
            let conditionMet = this.evaluateCondition(fieldValue, rule);

            if (rule.negate) {
                conditionMet = !conditionMet;
            }

            if (index === 0) {
                return conditionMet;
            }

            const logic = rule.logic || 'AND';
            return logic === 'AND' ? (result && conditionMet) : (result || conditionMet);
        }, true);
    }

    /**
     * Avalia uma condição única (operadores eq, neq, gt, in, etc.)
     */
    evaluateCondition(fieldValue, rule) {
        const { operator, value, values } = rule;
        
        // Normalizar valores para comparação
        const normalizedFieldValue = fieldValue === undefined || fieldValue === null ? "" : fieldValue;

        switch (operator) {
            case "eq":
                return String(normalizedFieldValue) === String(value);
            case "neq":
                return String(normalizedFieldValue) !== String(value);
            case "gt":
                return Number(normalizedFieldValue) > Number(value);
            case "gte":
                return Number(normalizedFieldValue) >= Number(value);
            case "lt":
                return Number(normalizedFieldValue) < Number(value);
            case "lte":
                return Number(normalizedFieldValue) <= Number(value);
            case "contains":
                return String(normalizedFieldValue).toLowerCase().includes(String(value).toLowerCase());
            case "startsWith":
                return String(normalizedFieldValue).toLowerCase().startsWith(String(value).toLowerCase());
            case "endsWith":
                return String(normalizedFieldValue).toLowerCase().endsWith(String(value).toLowerCase());
            case "in":
                if (!values || values.length === 0) return false;
                return values.some(v => String(normalizedFieldValue) === String(v));
            case "notIn":
                if (!values || values.length === 0) return true;
                return !values.some(v => String(normalizedFieldValue) === String(v));
            case "empty":
                return (
                    normalizedFieldValue === "" ||
                    normalizedFieldValue === null ||
                    normalizedFieldValue === undefined ||
                    (Array.isArray(normalizedFieldValue) && normalizedFieldValue.length === 0)
                );
            case "notEmpty":
                return (
                    normalizedFieldValue !== "" &&
                    normalizedFieldValue !== null &&
                    normalizedFieldValue !== undefined &&
                    (!Array.isArray(normalizedFieldValue) || normalizedFieldValue.length > 0)
                );
            default:
                return true;
        }
    }

    /**
     * Inicia o atualizador automático de campos defaultToNow
     */
    startDefaultToNowUpdater() {
        // Limpar intervalo anterior se existir
        if (this.defaultToNowInterval) {
            clearInterval(this.defaultToNowInterval);
        }

        this.defaultToNowInterval = setInterval(() => {
            const brazilNow = getBrazilNow();

            // Atualizar campos de hora
            document.querySelectorAll('input[type="time"][data-default-to-now="true"]').forEach(input => {
                if (!input.dataset.modified) {
                    const hours = brazilNow.hours;
                    const minutes = brazilNow.minutes;
                    const newVal = `${hours}:${minutes}`;
                    if (input.value !== newVal) {
                        input.value = newVal;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            });

            // Atualizar campos de data (apenas se o dia mudou)
            document.querySelectorAll('input[type="date"][data-default-to-now="true"]').forEach(input => {
                if (!input.dataset.modified) {
                    const year = brazilNow.year;
                    const month = brazilNow.month;
                    const day = brazilNow.day;
                    const currentDate = `${year}-${month}-${day}`;
                    if (input.value !== currentDate) {
                        input.value = currentDate;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            });

            // Atualizar campos de datetime-local
            document.querySelectorAll('input[type="datetime-local"][data-default-to-now="true"]').forEach(input => {
                if (!input.dataset.modified) {
                    const year = brazilNow.year;
                    const month = brazilNow.month;
                    const day = brazilNow.day;
                    const hours = brazilNow.hours;
                    const minutes = brazilNow.minutes;
                    const newVal = `${year}-${month}-${day}T${hours}:${minutes}`;
                    if (input.value !== newVal) {
                        input.value = newVal;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                }
            });
        }, 60000); // Atualizar a cada 1 minuto

        console.log('⏰ Atualizador defaultToNow iniciado (60s)');
    }

    /**
     * Para o atualizador de defaultToNow
     */
    stopDefaultToNowUpdater() {
        if (this.defaultToNowInterval) {
            clearInterval(this.defaultToNowInterval);
            this.defaultToNowInterval = null;
            console.log('⏹️ Atualizador defaultToNow parado');
        }
    }

    /**
     * Processa o submit do formulário
     */
    async handleFormSubmit(formConfig, form) {
        try {
            console.log(`💾 Salvando formulário '${formConfig.id}'...`);

            // Coletar dados do formulário HTML
            const formData = new FormData(form);
            const htmlData = Object.fromEntries(formData.entries());

            // Coletar dados do Alpine.js formData (para campos customizados)
            const alpineData = window.formData || {};

            // Mesclar dados: HTML tem prioridade sobre Alpine para campos que existem em ambos
            const data = { ...alpineData, ...htmlData };

            // Atualiza campos auto-current/defaultToNow para refletir o instante exato do envio
            const now = new Date();
            if (Array.isArray(formConfig.campos)) {
                formConfig.campos.forEach(campo => {
                    if (!campo || !campo.id) return;

                    const isAutoCurrent = campo.autoCurrent || campo.defaultToNow;
                    const isDateTimeField = ['datetime-local', 'datetime', 'date', 'time'].includes(campo.type || campo.tipo);

                    if (isAutoCurrent && isDateTimeField) {
                        const computed = computeDefaultValue(campo, {
                            now,
                            formValues: data,
                            user: this._getUserContext()
                        });
                        if (computed !== undefined && computed !== null) {
                            data[campo.id] = computed;

                            const fieldElement = form.querySelector(`[name="${campo.id}"]`);
                            if (fieldElement) {
                                fieldElement.value = computed;
                            }
                        }
                    }
                });
            }

            // Adicionar metadados
            const submission = {
                formId: formConfig.id,
                formTitle: formConfig.titulo || formConfig.title,
                data: data,
                submittedAt: new Date().toISOString(),
                userId: this.dataService?.userId || 'anonymous'
            };

            // Salvar no IndexedDB via DataService
            if (this.dataService) {
                await this.dataService.init();
                const recordId = await this.dataService.saveFormData(submission);
                console.log(`✅ Formulário salvo com ID: ${recordId}`);

                // Tentar sincronizar com Supabase
                try {
                    await this.dataService.syncSingleRecord(recordId);
                    console.log(`☁️ Formulário sincronizado com Supabase`);
                } catch (syncError) {
                    console.warn(`⚠️ Erro na sincronização:`, syncError);
                }
            }

            // Mostrar feedback ao usuário
            this.showSuccess('Formulário salvo com sucesso!');

            // Limpar formulário e resetar campos defaultToNow
            form.reset();

            // Resetar flags de modificação dos campos defaultToNow
            form.querySelectorAll('[data-default-to-now="true"]').forEach(input => {
                delete input.dataset.modified;
                // Atualizar imediatamente com o horário atual de Brasília
                const brazilNow = getBrazilNow();
                if (input.type === 'time') {
                    input.value = `${brazilNow.hours}:${brazilNow.minutes}`;
                } else if (input.type === 'date') {
                    input.value = `${brazilNow.year}-${brazilNow.month}-${brazilNow.day}`;
                } else if (input.type === 'datetime-local') {
                    input.value = `${brazilNow.year}-${brazilNow.month}-${brazilNow.day}T${brazilNow.hours}:${brazilNow.minutes}`;
                }
            });

            // Limpar formData após envio bem-sucedido para resetar campos
            if (window.formData) {
                // Resetar apenas os campos do formulário enviado
                formConfig.campos.forEach(campo => {
                    if (campo.id && window.formData[campo.id] !== undefined) {
                        // Para campos select com valor padrão, restaurar o valor padrão
                        const selectDefault = campo.value ?? campo.defaultValue;
                        if (campo.type === 'select' && selectDefault !== undefined) {
                            window.formData[campo.id] = selectDefault;
                        } else {
                            // Para outros campos, remover completamente
                            delete window.formData[campo.id];
                        }
                    }
                });
                console.log('🔄 FormData resetado após envio bem-sucedido');

                // Disparar evento para campos se atualizarem
                window.dispatchEvent(new CustomEvent('form-reset', {
                    detail: { formId: formConfig.id, resetFields: formConfig.campos.map(c => c.id) }
                }));
            }

        } catch (error) {
            console.error(`❌ Erro ao salvar formulário:`, error);
            if (typeof this.showError === 'function') {
                this.showError(null, `Erro ao salvar: ${error.message}`);
            } else {
                window.FormRenderer.prototype.showError.call(this, null, `Erro ao salvar: ${error.message}`);
            }
        }
    }

    /**
     * Aplica validações aos campos
     */
    applyValidations(formConfig) {
        if (!formConfig.campos) return;

        formConfig.campos.forEach(campo => {
            if (campo.validation && campo.validation.pattern) {
                const input = document.getElementById(campo.id);
                if (input) {
                    const regex = new RegExp(campo.validation.pattern);
                    const message = campo.validation.patternMessage || 'Formato inválido';

                    // Validação no blur
                    input.addEventListener('blur', () => {
                        if (input.value && !regex.test(input.value)) {
                            input.setCustomValidity(message);
                            input.reportValidity();
                        } else {
                            input.setCustomValidity('');
                        }
                    });

                    // Validação no input (tempo real)
                    input.addEventListener('input', () => {
                        if (input.value && !regex.test(input.value)) {
                            input.setCustomValidity(message);
                        } else {
                            input.setCustomValidity('');
                        }
                    });
                }
            }
        });
    }

    /**
     * Mostra mensagem de sucesso
     */
    showSuccess(message) {
        // Implementar notificação de sucesso
        console.log(`✅ ${message}`);
        alert(message); // Temporário - substituir por toast/notification
    }

    /**
     * Mostra mensagem de erro
     */
    showError(containerId, message) {
        console.error(`❌ ${message}`);

        if (containerId) {
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = `
                    <div class="alert alert-error">
                        <h3>Erro</h3>
                        <p>${message}</p>
                        <button onclick="location.reload()" class="btn btn-primary">Tentar Novamente</button>
                    </div>
                `;
            }
        } else {
            alert(message); // Temporário
        }
    }

    /**
     * Lista formulários disponíveis no Storage
     */
    async listAvailableForms() {
        if (!this.isInitialized) {
            await this.init();
        }
        return await this.smartCache.listAvailableForms();
    }

    /**
     * Lista dados disponíveis no Storage
     */
    async listAvailableData() {
        if (!this.isInitialized) {
            await this.init();
        }
        return await this.smartCache.listAvailableData();
    }

    /**
     * Limpa cache e recarrega formulário
     */
    async reloadForm(formId, containerId) {
        // Limpar intervalos
        this.stopDefaultToNowUpdater();

        // Limpar cache
        if (this.smartCache) {
            this.smartCache.clearCache();
        }
        this.loadedForms.delete(formId);

        // Recarregar
        return await this.loadForm(formId, containerId);
    }

    /**
     * Método para verificar conectividade e tentar sincronizar
     */
    async checkConnectivityAndSync() {
        try {
            // Tentar operação simples no Supabase
            const forms = await this.smartCache.listAvailableForms();

            if (forms.length > 0) {
                this.fallbackMode = false;
                this.lastSuccessfulSync = new Date().toISOString();
                console.log(`✅ Conectividade restaurada!`);
                return true;
            }

        } catch (error) {
            console.log(`❌ Ainda offline: ${error.message}`);
            return false;
        }

        return false;
    }

    /**
     * Auto-retry para sair do modo fallback
     */
    startConnectivityMonitoring() {
        // Limpar intervalo anterior se existir
        if (this.connectivityCheckInterval) {
            clearInterval(this.connectivityCheckInterval);
        }

        this.connectivityCheckInterval = setInterval(async () => {
            if (this.fallbackMode) {
                console.log(`🔄 Verificando conectividade...`);
                const isOnline = await this.checkConnectivityAndSync();

                if (isOnline) {
                    // Mostrar notificação de reconexão
                    this.showSuccess('✅ Conexão restaurada! Dados serão atualizados.');

                    // Opcionalmente recarregar formulários ativos
                    for (const [formId, formData] of this.loadedForms) {
                        if (formData.fallbackMode) {
                            console.log(`🔄 Recarregando '${formId}' com dados atualizados...`);
                            try {
                                await this.reloadForm(formId, formData.containerId);
                            } catch (error) {
                                console.error(`❌ Erro ao recarregar '${formId}':`, error);
                            }
                        }
                    }
                }
            }
        }, 30000); // Verificar a cada 30 segundos

        console.log('🔄 Monitoramento de conectividade iniciado (30s)');
    }

    /**
     * Para o monitoramento de conectividade
     */
    stopConnectivityMonitoring() {
        if (this.connectivityCheckInterval) {
            clearInterval(this.connectivityCheckInterval);
            this.connectivityCheckInterval = null;
            console.log('⏹️ Monitoramento de conectividade parado');
        }
    }

    /**
     * Cleanup completo - para todos os intervalos e libera recursos
     */
    cleanup() {
        this.stopConnectivityMonitoring();
        this.stopDefaultToNowUpdater();
        this.loadedForms.clear();
        console.log('🧹 FormRenderer cleanup completo');
    }

    /**
     * Obtém contexto do usuário para computeDefaultValue (defaults dinâmicos: user.name, user.email)
     */
    _getUserContext() {
        try {
            if (typeof window !== 'undefined' && window.authManager && window.authManager.currentUser) {
                return window.authManager.currentUser;
            }
        } catch (_) { /* offline / not initialized */ }
        return null;
    }

    /**
     * Obtém status detalhado do sistema
     */
    getSystemStatus() {
        return {
            isInitialized: this.isInitialized,
            fallbackMode: this.fallbackMode,
            lastSuccessfulSync: this.lastSuccessfulSync,
            loadedFormsCount: this.loadedForms.size,
            hasConnectivityMonitoring: !!this.connectivityCheckInterval,
            cacheStats: this.smartCache ? this.smartCache.getCacheStats() : null
        };
    }
}

// Exportar para uso global
window.FormRenderer = FormRenderer;