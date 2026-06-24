/**
 * VirtualScroller - Sistema de virtualização de campos de formulário
 * Renderiza apenas campos visíveis na viewport para otimizar performance
 * 
 * Características:
 * - Renderização apenas de campos visíveis
 * - Buffer zones (renderiza campos próximos para scroll suave)
 * - Detecção inteligente de scroll
 * - Suporte a diferentes alturas de campo
 * - Reciclagem de elementos DOM
 * - Lazy loading de campos
 * 
 * @example
 * const scroller = new VirtualScroller({
 *   container: document.getElementById('form-container'),
 *   fields: allFields,
 *   itemHeight: 80,
 *   bufferSize: 3
 * });
 */

import { eventBus } from './EventEmitter.js';

export class VirtualScroller {
    constructor(options = {}) {
        this.options = {
            container: null,
            fields: [],
            itemHeight: 80, // Altura média de um campo
            bufferSize: 3, // Número de campos extras acima/abaixo do viewport
            overscan: 5, // Campos adicionais para renderização preventiva
            estimatedHeight: true, // Usar altura estimada ou real
            scrollThrottle: 16, // ~60fps
            ...options
        };

        this.container = this.options.container;
        this.fields = this.options.fields;
        this.state = {
            scrollTop: 0,
            viewportHeight: 0,
            totalHeight: 0,
            visibleStart: 0,
            visibleEnd: 0,
            renderedItems: new Map()
        };

        this.scrollHandler = null;
        this.resizeObserver = null;
        this.heights = new Map(); // Cache de alturas reais dos campos

        this.init();
    }

    /**
     * Inicializa o virtual scroller
     */
    init() {
        if (!this.container) {
            console.error('VirtualScroller: container não fornecido');
            return;
        }

        // Configurar estrutura DOM
        this.setupDOM();

        // Calcular altura total
        this.calculateTotalHeight();

        // Configurar listeners
        this.setupListeners();

        // Renderização inicial
        this.updateVisibleRange();
        this.render();

        eventBus.emit('virtualScrollerInitialized', {
            totalFields: this.fields.length,
            totalHeight: this.state.totalHeight
        });
    }

    /**
     * Configura estrutura DOM necessária
     */
    setupDOM() {
        // Wrapper para scroll
        this.scrollContainer = document.createElement('div');
        this.scrollContainer.className = 'virtual-scroller';
        this.scrollContainer.style.cssText = `
            position: relative;
            overflow-y: auto;
            height: 100%;
            -webkit-overflow-scrolling: touch;
        `;

        // Spacer para simular altura total
        this.spacer = document.createElement('div');
        this.spacer.className = 'virtual-scroller-spacer';
        this.spacer.style.cssText = 'position: relative;';

        // Container para itens renderizados
        this.itemsContainer = document.createElement('div');
        this.itemsContainer.className = 'virtual-scroller-items';
        this.itemsContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
        `;

        this.spacer.appendChild(this.itemsContainer);
        this.scrollContainer.appendChild(this.spacer);

        // Substituir container original
        this.container.innerHTML = '';
        this.container.appendChild(this.scrollContainer);

        // Obter altura do viewport
        this.state.viewportHeight = this.scrollContainer.clientHeight;
    }

    /**
     * Configura event listeners
     */
    setupListeners() {
        // Scroll com throttle
        let scrollTimeout;
        this.scrollHandler = () => {
            if (scrollTimeout) return;

            scrollTimeout = setTimeout(() => {
                this.state.scrollTop = this.scrollContainer.scrollTop;
                this.updateVisibleRange();
                this.render();
                scrollTimeout = null;
            }, this.options.scrollThrottle);
        };

        this.scrollContainer.addEventListener('scroll', this.scrollHandler, { passive: true });

        // Resize observer para atualizar viewport
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(() => {
                this.state.viewportHeight = this.scrollContainer.clientHeight;
                this.updateVisibleRange();
                this.render();
            });

            this.resizeObserver.observe(this.scrollContainer);
        }

        // Listener global para resize
        window.addEventListener('resize', () => {
            this.state.viewportHeight = this.scrollContainer.clientHeight;
            this.updateVisibleRange();
            this.render();
        });
    }

    /**
     * Calcula altura total do formulário
     */
    calculateTotalHeight() {
        this.state.totalHeight = this.fields.reduce((sum, field, index) => {
            const height = this.getItemHeight(index);
            return sum + height;
        }, 0);

        this.spacer.style.height = `${this.state.totalHeight}px`;
    }

    /**
     * Retorna altura de um campo específico
     * @param {number} index - Índice do campo
     * @returns {number} - Altura em pixels
     */
    getItemHeight(index) {
        // Usar altura real se disponível
        if (this.heights.has(index)) {
            return this.heights.get(index);
        }

        // Altura estimada baseada no tipo de campo
        const field = this.fields[index];
        
        if (field.estimatedHeight) {
            return field.estimatedHeight;
        }

        // Altura padrão baseada no tipo
        switch (field.type) {
            case 'textarea':
                return 120;
            case 'signature':
            case 'camera':
            case 'photo-gallery':
                return 200;
            case 'checklist':
            case 'presence':
                return 150;
            case 'section-header':
                return 60;
            default:
                return this.options.itemHeight;
        }
    }

    /**
     * Atualiza range de campos visíveis
     */
    updateVisibleRange() {
        const { scrollTop, viewportHeight } = this.state;
        const { bufferSize, overscan } = this.options;

        // Encontrar primeiro item visível
        let currentTop = 0;
        let visibleStart = 0;

        for (let i = 0; i < this.fields.length; i++) {
            const itemHeight = this.getItemHeight(i);
            
            if (currentTop + itemHeight >= scrollTop) {
                visibleStart = Math.max(0, i - bufferSize);
                break;
            }

            currentTop += itemHeight;
        }

        // Encontrar último item visível
        let visibleEnd = visibleStart;
        currentTop = this.getOffsetTop(visibleStart);

        while (visibleEnd < this.fields.length && currentTop < scrollTop + viewportHeight) {
            currentTop += this.getItemHeight(visibleEnd);
            visibleEnd++;
        }

        visibleEnd = Math.min(this.fields.length, visibleEnd + bufferSize + overscan);

        this.state.visibleStart = visibleStart;
        this.state.visibleEnd = visibleEnd;

        eventBus.emit('virtualScrollerRangeUpdated', {
            visibleStart,
            visibleEnd,
            total: this.fields.length
        });
    }

    /**
     * Calcula offset top de um item
     * @param {number} index - Índice do item
     * @returns {number} - Offset em pixels
     */
    getOffsetTop(index) {
        let offset = 0;
        for (let i = 0; i < index; i++) {
            offset += this.getItemHeight(i);
        }
        return offset;
    }

    /**
     * Renderiza campos visíveis
     */
    render() {
        const { visibleStart, visibleEnd, renderedItems } = this.state;

        // Remover itens fora do range
        for (const [index, element] of renderedItems.entries()) {
            if (index < visibleStart || index >= visibleEnd) {
                element.remove();
                renderedItems.delete(index);
            }
        }

        // Renderizar itens no range
        for (let i = visibleStart; i < visibleEnd; i++) {
            if (!renderedItems.has(i)) {
                this.renderItem(i);
            }
        }

        // Emitir evento
        eventBus.emit('virtualScrollerRendered', {
            renderedCount: renderedItems.size,
            visibleStart,
            visibleEnd
        });
    }

    /**
     * Renderiza um campo específico
     * @param {number} index - Índice do campo
     */
    renderItem(index) {
        const field = this.fields[index];
        const offsetTop = this.getOffsetTop(index);

        // Criar elemento wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'virtual-field-wrapper';
        wrapper.setAttribute('data-index', index);
        wrapper.style.cssText = `
            position: absolute;
            top: ${offsetTop}px;
            left: 0;
            right: 0;
            transition: opacity 0.15s ease-in-out;
        `;

        // Renderizar campo (delegado para callback)
        if (typeof this.options.renderItem === 'function') {
            const content = this.options.renderItem(field, index);
            
            if (typeof content === 'string') {
                wrapper.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                wrapper.appendChild(content);
            }
        } else {
            // Renderização padrão simples
            wrapper.innerHTML = `
                <div class="field-container" data-field-id="${field.id}">
                    <label>${field.label || field.id}</label>
                    <input type="${field.type || 'text'}" id="${field.id}" />
                </div>
            `;
        }

        // Adicionar ao DOM
        this.itemsContainer.appendChild(wrapper);
        this.state.renderedItems.set(index, wrapper);

        // Medir altura real após renderização
        requestAnimationFrame(() => {
            const realHeight = wrapper.offsetHeight;
            
            if (realHeight > 0 && realHeight !== this.getItemHeight(index)) {
                this.heights.set(index, realHeight);
                
                // Recalcular altura total se mudou significativamente
                if (Math.abs(realHeight - this.getItemHeight(index)) > 10) {
                    this.calculateTotalHeight();
                }
            }
        });

        eventBus.emit('virtualScrollerItemRendered', { index, field });
    }

    /**
     * Atualiza lista de campos
     * @param {Array} fields - Nova lista de campos
     */
    updateFields(fields) {
        this.fields = fields;
        this.heights.clear();
        this.state.renderedItems.clear();
        this.itemsContainer.innerHTML = '';
        
        this.calculateTotalHeight();
        this.updateVisibleRange();
        this.render();

        eventBus.emit('virtualScrollerFieldsUpdated', {
            fieldCount: fields.length
        });
    }

    /**
     * Scroll para um campo específico
     * @param {number} index - Índice do campo
     * @param {object} options - Opções de scroll
     */
    scrollToIndex(index, options = {}) {
        const {
            behavior = 'smooth',
            block = 'start',
            offset = 0
        } = options;

        const targetTop = this.getOffsetTop(index) + offset;

        this.scrollContainer.scrollTo({
            top: targetTop,
            behavior
        });

        eventBus.emit('virtualScrollerScrolled', { index, targetTop });
    }

    /**
     * Retorna métricas de performance
     */
    getMetrics() {
        return {
            totalFields: this.fields.length,
            renderedFields: this.state.renderedItems.size,
            visibleStart: this.state.visibleStart,
            visibleEnd: this.state.visibleEnd,
            totalHeight: this.state.totalHeight,
            viewportHeight: this.state.viewportHeight,
            scrollTop: this.state.scrollTop,
            renderRatio: this.state.renderedItems.size / this.fields.length
        };
    }

    /**
     * Força re-render completo
     */
    forceUpdate() {
        this.heights.clear();
        this.calculateTotalHeight();
        this.updateVisibleRange();
        
        // Limpar itens renderizados
        this.state.renderedItems.clear();
        this.itemsContainer.innerHTML = '';
        
        this.render();
    }

    /**
     * Destrói o virtual scroller
     */
    destroy() {
        if (this.scrollHandler) {
            this.scrollContainer.removeEventListener('scroll', this.scrollHandler);
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        this.state.renderedItems.clear();
        this.heights.clear();
        
        eventBus.emit('virtualScrollerDestroyed');
    }
}

export default VirtualScroller;
