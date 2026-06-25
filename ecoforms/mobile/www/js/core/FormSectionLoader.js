/**
 * FormSectionLoader - Carregamento por seções e progressivo de formulários
 * Divide formulários grandes em seções carregáveis sob demanda
 * 
 * Características:
 * - Carregamento lazy de seções
 * - Priorização de seções (críticas primeiro)
 * - Carregamento progressivo em background
 * - Skeleton/placeholder durante carregamento
 * - Prefetch de seções próximas
 * - Cancelamento de carregamentos pendentes
 * 
 * @example
 * const loader = new FormSectionLoader({
 *   sections: formSections,
 *   strategy: 'progressive'
 * });
 * 
 * await loader.loadSection('basic-info');
 */

import { eventBus } from './EventEmitter.js';

export class FormSectionLoader {
    constructor(options = {}) {
        this.options = {
            sections: [],
            strategy: 'lazy', // 'lazy', 'progressive', 'eager'
            priority: 'sequential', // 'sequential', 'priority', 'parallel'
            maxConcurrent: 3,
            prefetchDistance: 1, // Número de seções à frente para prefetch
            showSkeletons: true,
            ...options
        };

        this.sections = new Map(); // Seções configuradas
        this.loadedSections = new Set(); // Seções já carregadas
        this.loadingQueue = []; // Fila de carregamento
        this.activeLoads = new Map(); // Carregamentos ativos
        this.sectionElements = new Map(); // Elementos DOM das seções

        this.initializeSections();
    }

    /**
     * Inicializa seções do formulário
     */
    initializeSections() {
        this.options.sections.forEach((section, index) => {
            this.sections.set(section.id, {
                ...section,
                index,
                priority: section.priority || index,
                loaded: false,
                loading: false,
                fields: section.fields || [],
                dependencies: section.dependencies || []
            });
        });

        eventBus.emit('formSectionLoaderInitialized', {
            sectionCount: this.sections.size
        });
    }

    /**
     * Carrega uma seção específica
     * @param {string} sectionId - ID da seção
     * @param {object} options - Opções de carregamento
     * @returns {Promise} - Promise que resolve quando seção está carregada
     */
    async loadSection(sectionId, options = {}) {
        const section = this.sections.get(sectionId);

        if (!section) {
            throw new Error(`Seção não encontrada: ${sectionId}`);
        }

        // Já carregada
        if (this.loadedSections.has(sectionId)) {
            return section;
        }

        // Já em carregamento
        if (this.activeLoads.has(sectionId)) {
            return this.activeLoads.get(sectionId);
        }

        // Verificar dependências
        if (section.dependencies.length > 0) {
            await this.loadDependencies(section.dependencies);
        }

        // Iniciar carregamento
        const loadPromise = this.executeLoad(section, options);
        this.activeLoads.set(sectionId, loadPromise);

        try {
            const result = await loadPromise;
            this.loadedSections.add(sectionId);
            section.loaded = true;
            section.loading = false;
            this.activeLoads.delete(sectionId);

            // Prefetch de seções próximas
            if (this.options.prefetchDistance > 0) {
                this.prefetchNearby(section.index);
            }

            eventBus.emit('formSectionLoaded', {
                sectionId,
                fieldCount: section.fields.length
            });

            return result;
        } catch (error) {
            section.loading = false;
            this.activeLoads.delete(sectionId);
            
            eventBus.emit('formSectionLoadError', {
                sectionId,
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Executa carregamento de uma seção
     */
    async executeLoad(section, options = {}) {
        section.loading = true;

        const startTime = performance.now();

        // Mostrar skeleton se configurado
        if (this.options.showSkeletons) {
            this.renderSkeleton(section);
        }

        try {
            // Simular delay de rede se especificado (útil para testes)
            if (options.simulateDelay) {
                await this.sleep(options.simulateDelay);
            }

            // Carregar campos da seção
            const fields = await this.loadSectionFields(section);

            // Renderizar seção
            const element = this.renderSection(section, fields);

            const loadTime = performance.now() - startTime;

            return {
                section,
                fields,
                element,
                loadTime
            };
        } catch (error) {
            console.error(`Erro ao carregar seção ${section.id}:`, error);
            throw error;
        }
    }

    /**
     * Carrega campos de uma seção
     */
    async loadSectionFields(section) {
        // Se callback customizado fornecido
        if (typeof this.options.loadFields === 'function') {
            return await this.options.loadFields(section);
        }

        // Retornar campos configurados
        return section.fields;
    }

    /**
     * Renderiza skeleton durante carregamento
     */
    renderSkeleton(section) {
        const container = this.getSectionContainer(section.id);
        
        if (!container) return;

        const skeletonCount = Math.min(section.fields?.length || 3, 10);
        
        container.innerHTML = `
            <div class="section-skeleton" data-section="${section.id}">
                <div class="skeleton-header animate-pulse">
                    <div class="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                </div>
                ${Array(skeletonCount).fill(0).map(() => `
                    <div class="skeleton-field animate-pulse mb-4">
                        <div class="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                        <div class="h-10 bg-gray-100 rounded w-full"></div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Renderiza seção carregada
     */
    renderSection(section, fields) {
        const container = this.getSectionContainer(section.id);
        
        if (!container) {
            console.warn(`Container não encontrado para seção: ${section.id}`);
            return null;
        }

        // Limpar skeleton
        container.innerHTML = '';

        // Criar elemento da seção
        const sectionElement = document.createElement('div');
        sectionElement.className = 'form-section loaded';
        sectionElement.setAttribute('data-section-id', section.id);
        sectionElement.setAttribute('data-loaded', 'true');

        // Header da seção
        if (section.title || section.description) {
            const header = document.createElement('div');
            header.className = 'section-header';
            
            if (section.title) {
                const title = document.createElement('h3');
                title.className = 'section-title';
                title.textContent = section.title;
                header.appendChild(title);
            }

            if (section.description) {
                const desc = document.createElement('p');
                desc.className = 'section-description';
                desc.textContent = section.description;
                header.appendChild(desc);
            }

            sectionElement.appendChild(header);
        }

        // Container dos campos
        const fieldsContainer = document.createElement('div');
        fieldsContainer.className = 'section-fields';
        fieldsContainer.setAttribute('data-section-id', section.id);

        // Renderizar campos (delegar para callback se fornecido)
        if (typeof this.options.renderFields === 'function') {
            const rendered = this.options.renderFields(fields, section);
            
            if (typeof rendered === 'string') {
                fieldsContainer.innerHTML = rendered;
            } else if (rendered instanceof HTMLElement) {
                fieldsContainer.appendChild(rendered);
            } else if (Array.isArray(rendered)) {
                rendered.forEach(el => fieldsContainer.appendChild(el));
            }
        } else {
            fieldsContainer.innerHTML = `<p class="text-gray-500">Renderizador de campos não configurado</p>`;
        }

        sectionElement.appendChild(fieldsContainer);
        container.appendChild(sectionElement);

        this.sectionElements.set(section.id, sectionElement);

        return sectionElement;
    }

    /**
     * Obtém container DOM de uma seção
     */
    getSectionContainer(sectionId) {
        // Tentar encontrar container específico
        let container = document.querySelector(`[data-section-container="${sectionId}"]`);

        // Fallback para container geral
        if (!container) {
            container = document.getElementById(`section-${sectionId}`);
        }

        // Fallback para container principal
        if (!container && this.options.mainContainer) {
            container = this.options.mainContainer;
        }

        return container;
    }

    /**
     * Carrega dependências de uma seção
     */
    async loadDependencies(dependencies) {
        const loadPromises = dependencies.map(depId => {
            if (!this.loadedSections.has(depId)) {
                return this.loadSection(depId);
            }
            return Promise.resolve();
        });

        await Promise.all(loadPromises);
    }

    /**
     * Prefetch de seções próximas
     */
    async prefetchNearby(currentIndex) {
        const sectionsArray = Array.from(this.sections.values())
            .sort((a, b) => a.index - b.index);

        // Prefetch seções à frente
        for (let i = 1; i <= this.options.prefetchDistance; i++) {
            const nextIndex = currentIndex + i;
            
            if (nextIndex < sectionsArray.length) {
                const nextSection = sectionsArray[nextIndex];
                
                if (!this.loadedSections.has(nextSection.id) && !this.activeLoads.has(nextSection.id)) {
                    // Carregar em background sem aguardar
                    this.loadSection(nextSection.id).catch(err => {
                        console.warn(`Prefetch falhou para seção ${nextSection.id}:`, err);
                    });
                }
            }
        }
    }

    /**
     * Carrega todas as seções de acordo com a estratégia
     */
    async loadAll() {
        const strategy = this.options.strategy;

        switch (strategy) {
            case 'progressive':
                return await this.loadProgressive();
            
            case 'eager':
                return await this.loadEager();
            
            case 'lazy':
            default:
                // Lazy não carrega automaticamente
                return { strategy: 'lazy', message: 'Use loadSection() para carregar sob demanda' };
        }
    }

    /**
     * Carregamento progressivo (prioridade)
     */
    async loadProgressive() {
        const sectionsArray = Array.from(this.sections.values())
            .sort((a, b) => a.priority - b.priority);

        const results = [];
        const startTime = performance.now();

        for (const section of sectionsArray) {
            try {
                const result = await this.loadSection(section.id);
                results.push(result);

                eventBus.emit('formProgressiveLoadProgress', {
                    loaded: results.length,
                    total: sectionsArray.length,
                    percentage: (results.length / sectionsArray.length * 100).toFixed(2)
                });
            } catch (error) {
                console.error(`Erro no carregamento progressivo da seção ${section.id}:`, error);
            }
        }

        const totalTime = performance.now() - startTime;

        eventBus.emit('formProgressiveLoadComplete', {
            sections: results.length,
            totalTime
        });

        return { results, totalTime };
    }

    /**
     * Carregamento eager (paralelo)
     */
    async loadEager() {
        const sectionsArray = Array.from(this.sections.values());
        const startTime = performance.now();

        const results = await Promise.allSettled(
            sectionsArray.map(section => this.loadSection(section.id))
        );

        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        const totalTime = performance.now() - startTime;

        eventBus.emit('formEagerLoadComplete', {
            succeeded,
            failed,
            total: sectionsArray.length,
            totalTime
        });

        return {
            results,
            succeeded,
            failed,
            totalTime
        };
    }

    /**
     * Descarrega uma seção (libera memória)
     */
    unloadSection(sectionId) {
        const section = this.sections.get(sectionId);
        
        if (!section) return false;

        // Remover elemento DOM
        const element = this.sectionElements.get(sectionId);
        if (element) {
            element.remove();
            this.sectionElements.delete(sectionId);
        }

        // Marcar como não carregada
        section.loaded = false;
        this.loadedSections.delete(sectionId);

        eventBus.emit('formSectionUnloaded', { sectionId });

        return true;
    }

    /**
     * Descarrega seções fora da viewport (memory management)
     */
    unloadOffscreen() {
        let unloaded = 0;

        for (const [sectionId, element] of this.sectionElements.entries()) {
            if (!this.isInViewport(element)) {
                this.unloadSection(sectionId);
                unloaded++;
            }
        }

        if (unloaded > 0) {
            eventBus.emit('formSectionsUnloaded', { count: unloaded });
        }

        return unloaded;
    }

    /**
     * Verifica se elemento está na viewport
     */
    isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top < window.innerHeight &&
            rect.bottom > 0
        );
    }

    /**
     * Cancela carregamentos pendentes
     */
    cancelPending() {
        const canceled = this.activeLoads.size;
        
        // Limpar carregamentos ativos (não há como cancelar Promises, mas podemos limpar referências)
        this.activeLoads.clear();
        this.loadingQueue = [];

        eventBus.emit('formLoadsCanceled', { count: canceled });

        return canceled;
    }

    /**
     * Obtém estatísticas de carregamento
     */
    getStats() {
        return {
            totalSections: this.sections.size,
            loadedSections: this.loadedSections.size,
            activeSections: this.activeLoads.size,
            loadProgress: (this.loadedSections.size / this.sections.size * 100).toFixed(2) + '%',
            sections: Array.from(this.sections.values()).map(s => ({
                id: s.id,
                loaded: s.loaded,
                loading: s.loading,
                priority: s.priority,
                fieldCount: s.fields?.length || 0
            }))
        };
    }

    /**
     * Utilitário para sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Destrói o loader
     */
    destroy() {
        this.cancelPending();
        this.sectionElements.clear();
        this.loadedSections.clear();
        this.sections.clear();

        eventBus.emit('formSectionLoaderDestroyed');
    }
}

export default FormSectionLoader;
