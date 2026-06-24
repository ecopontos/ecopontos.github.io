/**
 * ProgressiveFormRenderer - Sistema completo de renderização progressiva
 * Combina VirtualScroller, FieldMemoizer e FormSectionLoader
 * 
 * Estratégias:
 * 1. Priority Queue - Campos críticos primeiro
 * 2. Chunking - Renderização em lotes para não bloquear UI
 * 3. Idle Rendering - Usa requestIdleCallback para renderização em background
 * 4. Critical Path - Campos visíveis e required primeiro
 * 
 * @example
 * const renderer = new ProgressiveFormRenderer({
 *   form: formConfig,
 *   container: document.getElementById('form'),
 *   strategy: 'critical-first'
 * });
 * 
 * await renderer.render();
 */

import { eventBus } from './EventEmitter.js';
import VirtualScroller from './VirtualScroller.js';
import { FieldMemoizer, FieldRenderer } from './FieldMemoizer.js';
import FormSectionLoader from './FormSectionLoader.js';

export class ProgressiveFormRenderer {
    constructor(options = {}) {
        this.options = {
            form: null,
            container: null,
            strategy: 'critical-first', // 'critical-first', 'priority', 'sequential', 'virtual'
            chunkSize: 10, // Campos por chunk
            chunkDelay: 0, // Delay entre chunks (ms)
            useVirtualization: false, // Usar VirtualScroller
            useMemoization: true,
            useSectionLoading: false,
            idleTimeout: 50, // Timeout para requestIdleCallback
            ...options
        };

        // Inicializar subsistemas
        this.fieldRenderer = new FieldRenderer({
            enableMemoization: this.options.useMemoization
        });

        this.virtualScroller = null;
        this.sectionLoader = null;

        // Estado
        this.state = {
            rendered: new Set(),
            pending: [],
            criticalFields: [],
            backgroundFields: [],
            renderStartTime: null,
            renderEndTime: null
        };

        // Métricas
        this.metrics = {
            totalFields: 0,
            renderedFields: 0,
            criticalFields: 0,
            backgroundFields: 0,
            renderTime: 0,
            chunksProcessed: 0
        };

        this.initialize();
    }

    /**
     * Inicializa o renderer
     */
    initialize() {
        if (!this.options.form || !this.options.container) {
            throw new Error('Form e container são obrigatórios');
        }

        // Categorizar campos
        this.categorizeFields();

        // Configurar virtualização se habilitada
        if (this.options.useVirtualization) {
            this.setupVirtualization();
        }

        // Configurar section loading se habilitada
        if (this.options.useSectionLoading && this.options.form.sections) {
            this.setupSectionLoading();
        }

        eventBus.emit('progressiveRendererInitialized', {
            totalFields: this.metrics.totalFields,
            strategy: this.options.strategy
        });
    }

    /**
     * Categoriza campos por prioridade
     */
    categorizeFields() {
        const fields = this.getAllFields();
        this.metrics.totalFields = fields.length;

        fields.forEach(field => {
            const priority = this.calculateFieldPriority(field);
            
            field._priority = priority;
            field._rendered = false;

            if (priority >= 100) {
                this.state.criticalFields.push(field);
                this.metrics.criticalFields++;
            } else {
                this.state.backgroundFields.push(field);
                this.metrics.backgroundFields++;
            }
        });

        // Ordenar por prioridade
        this.state.criticalFields.sort((a, b) => b._priority - a._priority);
        this.state.backgroundFields.sort((a, b) => b._priority - a._priority);

        this.state.pending = [...this.state.criticalFields, ...this.state.backgroundFields];
    }

    /**
     * Obtém todos os campos do formulário
     */
    getAllFields() {
        if (this.options.form.fields) {
            return this.options.form.fields;
        }

        if (this.options.form.sections) {
            return this.options.form.sections.flatMap(s => s.fields || []);
        }

        return [];
    }

    /**
     * Calcula prioridade de um campo
     */
    calculateFieldPriority(field) {
        let priority = 50; // Prioridade base

        // Campos obrigatórios
        if (field.required) {
            priority += 50;
        }

        // Campos visíveis (não hidden, não conditional hidden)
        if (!field.hidden && !field.conditionalHidden) {
            priority += 30;
        }

        // Campos no topo do formulário
        if (field.order !== undefined && field.order < 10) {
            priority += 20;
        }

        // Campos de seção crítica
        if (field.section === 'basic-info' || field.section === 'identification') {
            priority += 40;
        }

        // Campos simples (text, email, etc.) são mais rápidos
        const simpleTypes = ['text', 'email', 'tel', 'number', 'date'];
        if (simpleTypes.includes(field.type)) {
            priority += 10;
        }

        // Campos complexos têm menor prioridade
        const complexTypes = ['signature', 'camera', 'photo-gallery', 'checklist'];
        if (complexTypes.includes(field.type)) {
            priority -= 20;
        }

        // Prioridade explícita
        if (field.priority !== undefined) {
            priority = field.priority;
        }

        return Math.max(0, Math.min(200, priority)); // Limitar entre 0-200
    }

    /**
     * Renderiza o formulário progressivamente
     */
    async render() {
        this.state.renderStartTime = performance.now();

        eventBus.emit('progressiveRenderStarted', {
            totalFields: this.metrics.totalFields,
            strategy: this.options.strategy
        });

        try {
            switch (this.options.strategy) {
                case 'critical-first':
                    await this.renderCriticalFirst();
                    break;

                case 'priority':
                    await this.renderByPriority();
                    break;

                case 'sequential':
                    await this.renderSequential();
                    break;

                case 'virtual':
                    await this.renderVirtual();
                    break;

                default:
                    await this.renderCriticalFirst();
            }

            this.state.renderEndTime = performance.now();
            this.metrics.renderTime = this.state.renderEndTime - this.state.renderStartTime;

            eventBus.emit('progressiveRenderCompleted', {
                ...this.metrics,
                renderTime: this.metrics.renderTime
            });

            return {
                success: true,
                metrics: this.metrics
            };

        } catch (error) {
            console.error('Erro na renderização progressiva:', error);
            
            eventBus.emit('progressiveRenderError', {
                error: error.message
            });

            throw error;
        }
    }

    /**
     * Estratégia: Critical First
     * Renderiza campos críticos imediatamente, depois background
     */
    async renderCriticalFirst() {
        console.log(`🚀 Renderizando ${this.state.criticalFields.length} campos críticos...`);

        // Fase 1: Campos críticos (bloqueante)
        await this.renderFieldsInChunks(this.state.criticalFields, {
            blocking: true
        });

        console.log(`✅ Campos críticos renderizados`);

        // Fase 2: Campos background (não bloqueante)
        console.log(`🔄 Renderizando ${this.state.backgroundFields.length} campos em background...`);
        
        this.renderFieldsInBackground(this.state.backgroundFields);
    }

    /**
     * Estratégia: By Priority
     * Renderiza todos os campos em ordem de prioridade
     */
    async renderByPriority() {
        await this.renderFieldsInChunks(this.state.pending, {
            blocking: false
        });
    }

    /**
     * Estratégia: Sequential
     * Renderiza campos na ordem definida
     */
    async renderSequential() {
        const fields = this.getAllFields();
        await this.renderFieldsInChunks(fields, { blocking: false });
    }

    /**
     * Estratégia: Virtual
     * Usa VirtualScroller para renderizar apenas visíveis
     */
    async renderVirtual() {
        if (!this.virtualScroller) {
            this.setupVirtualization();
        }

        // VirtualScroller cuida da renderização
        return { mode: 'virtual', virtualScroller: this.virtualScroller };
    }

    /**
     * Renderiza campos em chunks (lotes)
     */
    async renderFieldsInChunks(fields, options = {}) {
        const { blocking = false } = options;
        const chunks = this.chunkArray(fields, this.options.chunkSize);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            if (blocking) {
                // Renderização bloqueante (aguarda cada chunk)
                await this.renderChunk(chunk);
            } else {
                // Renderização não bloqueante (usa requestAnimationFrame)
                await this.renderChunkAsync(chunk);
            }

            this.metrics.chunksProcessed++;

            // Delay entre chunks se configurado
            if (this.options.chunkDelay > 0) {
                await this.sleep(this.options.chunkDelay);
            }

            // Emitir progresso
            eventBus.emit('progressiveRenderProgress', {
                chunk: i + 1,
                totalChunks: chunks.length,
                fieldsRendered: this.metrics.renderedFields,
                totalFields: this.metrics.totalFields,
                percentage: (this.metrics.renderedFields / this.metrics.totalFields * 100).toFixed(2)
            });
        }
    }

    /**
     * Renderiza um chunk de campos (síncrono)
     */
    async renderChunk(fields) {
        for (const field of fields) {
            await this.renderField(field);
        }
    }

    /**
     * Renderiza um chunk de campos (assíncrono, não bloqueia UI)
     */
    renderChunkAsync(fields) {
        return new Promise((resolve) => {
            requestAnimationFrame(async () => {
                for (const field of fields) {
                    await this.renderField(field);
                }
                resolve();
            });
        });
    }

    /**
     * Renderiza campos em background usando requestIdleCallback
     */
    renderFieldsInBackground(fields) {
        const renderNext = (deadline) => {
            while (deadline.timeRemaining() > 0 && fields.length > 0) {
                const field = fields.shift();
                this.renderField(field).catch(err => {
                    console.error(`Erro ao renderizar campo ${field.id}:`, err);
                });
            }

            if (fields.length > 0) {
                requestIdleCallback(renderNext, { timeout: this.options.idleTimeout });
            } else {
                console.log('✅ Todos os campos background renderizados');
                eventBus.emit('progressiveRenderBackgroundCompleted');
            }
        };

        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(renderNext, { timeout: this.options.idleTimeout });
        } else {
            // Fallback para navegadores sem requestIdleCallback
            setTimeout(() => this.renderFieldsInChunks(fields, { blocking: false }), 100);
        }
    }

    /**
     * Renderiza um campo individual
     */
    async renderField(field) {
        if (this.state.rendered.has(field.id)) {
            return; // Já renderizado
        }

        try {
            // Usar FieldRenderer com memoização
            const rendered = this.fieldRenderer.render(field);

            // Adicionar ao DOM
            this.appendToDOM(rendered, field);

            this.state.rendered.add(field.id);
            field._rendered = true;
            this.metrics.renderedFields++;

            eventBus.emit('fieldRendered', {
                fieldId: field.id,
                type: field.type
            });

        } catch (error) {
            console.error(`Erro ao renderizar campo ${field.id}:`, error);
            throw error;
        }
    }

    /**
     * Adiciona campo renderizado ao DOM
     */
    appendToDOM(rendered, field) {
        // Se usar VirtualScroller, delegar a ele
        if (this.virtualScroller) {
            return; // VirtualScroller gerencia DOM
        }

        // Encontrar container apropriado
        const container = this.findFieldContainer(field);

        if (!container) {
            console.warn(`Container não encontrado para campo ${field.id}`);
            return;
        }

        // Adicionar ao DOM
        if (typeof rendered === 'string') {
            const wrapper = document.createElement('div');
            wrapper.innerHTML = rendered;
            container.appendChild(wrapper.firstElementChild || wrapper);
        } else if (rendered instanceof HTMLElement) {
            container.appendChild(rendered);
        }
    }

    /**
     * Encontra container apropriado para um campo
     */
    findFieldContainer(field) {
        // Container por seção
        if (field.section) {
            const sectionContainer = this.options.container.querySelector(
                `[data-section-id="${field.section}"] .section-fields`
            );
            if (sectionContainer) return sectionContainer;
        }

        // Container principal
        return this.options.container;
    }

    /**
     * Configura VirtualScroller
     */
    setupVirtualization() {
        const fields = this.getAllFields();

        this.virtualScroller = new VirtualScroller({
            container: this.options.container,
            fields,
            itemHeight: 80,
            bufferSize: 3,
            renderItem: (field, index) => {
                return this.fieldRenderer.render(field);
            }
        });
    }

    /**
     * Configura FormSectionLoader
     */
    setupSectionLoading() {
        this.sectionLoader = new FormSectionLoader({
            sections: this.options.form.sections,
            strategy: 'progressive',
            mainContainer: this.options.container,
            loadFields: async (section) => {
                return section.fields || [];
            },
            renderFields: (fields, section) => {
                return fields.map(f => this.fieldRenderer.render(f));
            }
        });
    }

    /**
     * Utilitários
     */
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Obtém métricas de renderização
     */
    getMetrics() {
        return {
            ...this.metrics,
            fieldRenderer: this.fieldRenderer.getMetrics(),
            virtualScroller: this.virtualScroller?.getMetrics(),
            sectionLoader: this.sectionLoader?.getStats()
        };
    }

    /**
     * Força re-render completo
     */
    async forceRerender() {
        this.state.rendered.clear();
        this.metrics.renderedFields = 0;
        this.metrics.chunksProcessed = 0;

        if (this.virtualScroller) {
            this.virtualScroller.forceUpdate();
        }

        await this.render();
    }

    /**
     * Destrói o renderer
     */
    destroy() {
        if (this.virtualScroller) {
            this.virtualScroller.destroy();
        }

        if (this.sectionLoader) {
            this.sectionLoader.destroy();
        }

        this.state.rendered.clear();
        this.state.pending = [];

        eventBus.emit('progressiveRendererDestroyed');
    }
}

export default ProgressiveFormRenderer;
