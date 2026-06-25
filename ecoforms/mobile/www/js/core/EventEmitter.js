/**
 * EventEmitter - Sistema de eventos leve e desacoplado
 * Permite comunicação entre módulos sem dependências diretas
 * 
 * Eventos suportados:
 * - formSaved: quando um formulário é salvo
 * - syncCompleted: quando sincronização é concluída
 * - authChanged: quando estado de autenticação muda
 * - conflictDetected: quando conflito é detectado
 * - operationQueued: quando operação é adicionada à fila
 * - cacheUpdated: quando cache é atualizado
 * - permissionChanged: quando permissões mudam
 * - validationFailed: quando validação falha
 * 
 * @example
 * // Em um módulo
 * eventBus.emit('formSaved', { formId: 'form-123', data: {...} });
 * 
 * // Em outro módulo
 * eventBus.on('formSaved', (payload) => {
 *   console.log('Form saved:', payload.formId);
 * });
 */
export class EventEmitter {
    constructor() {
        this.events = new Map();
        this.maxListeners = 10;
        this.debugMode = false;
    }

    /**
     * Registra um listener para um evento
     * @param {string} event - Nome do evento
     * @param {Function} listener - Função callback
     * @param {object} options - Opções (once, priority)
     * @returns {Function} - Função para remover o listener
     */
    on(event, listener, options = {}) {
        if (typeof listener !== 'function') {
            throw new TypeError('Listener must be a function');
        }

        if (!this.events.has(event)) {
            this.events.set(event, []);
        }

        const listeners = this.events.get(event);

        // Verificar limite de listeners
        if (listeners.length >= this.maxListeners) {
            console.warn(
                `EventEmitter: Warning - Event "${event}" has ${listeners.length} listeners. ` +
                `Max listeners: ${this.maxListeners}. Consider using once() or reviewing listeners.`
            );
        }

        const wrappedListener = {
            listener,
            once: options.once || false,
            priority: options.priority || 0,
            context: options.context || null
        };

        // Inserir listener ordenado por prioridade (maior primeiro)
        const insertIndex = listeners.findIndex(l => l.priority < wrappedListener.priority);
        if (insertIndex === -1) {
            listeners.push(wrappedListener);
        } else {
            listeners.splice(insertIndex, 0, wrappedListener);
        }

        if (this.debugMode) {
            console.log(`[EventEmitter] Registered listener for "${event}" (priority: ${options.priority || 0})`);
        }

        // Retornar função para remover listener
        return () => this.off(event, listener);
    }

    /**
     * Registra um listener que será executado apenas uma vez
     * @param {string} event - Nome do evento
     * @param {Function} listener - Função callback
     * @param {object} options - Opções adicionais
     * @returns {Function} - Função para remover o listener
     */
    once(event, listener, options = {}) {
        return this.on(event, listener, { ...options, once: true });
    }

    /**
     * Remove um listener específico de um evento
     * @param {string} event - Nome do evento
     * @param {Function} listener - Função callback a remover
     */
    off(event, listener) {
        if (!this.events.has(event)) {
            return;
        }

        const listeners = this.events.get(event);
        const index = listeners.findIndex(l => l.listener === listener);

        if (index !== -1) {
            listeners.splice(index, 1);
            if (this.debugMode) {
                console.log(`[EventEmitter] Removed listener from "${event}"`);
            }
        }

        // Limpar array se vazio
        if (listeners.length === 0) {
            this.events.delete(event);
        }
    }

    /**
     * Remove todos os listeners de um evento (ou todos os eventos se não especificado)
     * @param {string} [event] - Nome do evento (opcional)
     */
    removeAllListeners(event) {
        if (event) {
            this.events.delete(event);
            if (this.debugMode) {
                console.log(`[EventEmitter] Removed all listeners from "${event}"`);
            }
        } else {
            this.events.clear();
            if (this.debugMode) {
                console.log('[EventEmitter] Removed all listeners from all events');
            }
        }
    }

    /**
     * Emite um evento, chamando todos os listeners registrados
     * @param {string} event - Nome do evento
     * @param {*} payload - Dados a passar para os listeners
     * @returns {boolean} - true se havia listeners, false caso contrário
     */
    emit(event, payload) {
        if (!this.events.has(event)) {
            if (this.debugMode) {
                console.log(`[EventEmitter] No listeners for event "${event}"`);
            }
            return false;
        }

        const listeners = [...this.events.get(event)]; // Clone para evitar problemas com modificações durante iteração

        if (this.debugMode) {
            console.log(`[EventEmitter] Emitting "${event}" to ${listeners.length} listener(s)`, payload);
        }

        let hasError = false;

        listeners.forEach(({ listener, once, context }) => {
            try {
                // Chamar listener com contexto se fornecido
                if (context) {
                    listener.call(context, payload);
                } else {
                    listener(payload);
                }

                // Remover listener se configurado para executar apenas uma vez
                if (once) {
                    this.off(event, listener);
                }
            } catch (error) {
                hasError = true;
                console.error(`[EventEmitter] Error in listener for "${event}":`, error);
                
                // Emitir evento de erro interno
                this.safeEmit('error', {
                    event,
                    error,
                    payload
                });
            }
        });

        return !hasError;
    }

    /**
     * Emite um evento de forma assíncrona
     * @param {string} event - Nome do evento
     * @param {*} payload - Dados a passar para os listeners
     * @returns {Promise<boolean>} - Promise que resolve quando todos os listeners terminarem
     */
    async emitAsync(event, payload) {
        if (!this.events.has(event)) {
            return false;
        }

        const listeners = [...this.events.get(event)];

        if (this.debugMode) {
            console.log(`[EventEmitter] Emitting async "${event}" to ${listeners.length} listener(s)`, payload);
        }

        const promises = listeners.map(async ({ listener, once, context }) => {
            try {
                const result = context ? listener.call(context, payload) : listener(payload);
                
                // Suportar listeners síncronos e assíncronos
                await result;

                if (once) {
                    this.off(event, listener);
                }

                return true;
            } catch (error) {
                console.error(`[EventEmitter] Error in async listener for "${event}":`, error);
                this.safeEmit('error', { event, error, payload });
                return false;
            }
        });

        const results = await Promise.all(promises);
        return results.every(r => r);
    }

    /**
     * Emite um evento sem lançar exceções (para eventos internos)
     * @param {string} event - Nome do evento
     * @param {*} payload - Dados a passar para os listeners
     */
    safeEmit(event, payload) {
        try {
            this.emit(event, payload);
        } catch (error) {
            console.error(`[EventEmitter] Critical error in safeEmit for "${event}":`, error);
        }
    }

    /**
     * Retorna o número de listeners para um evento
     * @param {string} event - Nome do evento
     * @returns {number} - Número de listeners
     */
    listenerCount(event) {
        return this.events.has(event) ? this.events.get(event).length : 0;
    }

    /**
     * Retorna array com nomes de todos os eventos registrados
     * @returns {string[]} - Array de nomes de eventos
     */
    eventNames() {
        return Array.from(this.events.keys());
    }

    /**
     * Retorna todos os listeners para um evento
     * @param {string} event - Nome do evento
     * @returns {Function[]} - Array de funções listener
     */
    listeners(event) {
        if (!this.events.has(event)) {
            return [];
        }
        return this.events.get(event).map(l => l.listener);
    }

    /**
     * Define o número máximo de listeners por evento
     * @param {number} max - Número máximo de listeners
     */
    setMaxListeners(max) {
        if (typeof max !== 'number' || max < 0) {
            throw new TypeError('Max listeners must be a non-negative number');
        }
        this.maxListeners = max;
    }

    /**
     * Ativa ou desativa modo debug
     * @param {boolean} enabled - true para ativar debug
     */
    setDebugMode(enabled) {
        this.debugMode = !!enabled;
    }

    /**
     * Retorna estatísticas sobre o EventEmitter
     * @returns {object} - Objeto com estatísticas
     */
    getStats() {
        const events = this.eventNames();
        const totalListeners = events.reduce((sum, event) => sum + this.listenerCount(event), 0);

        return {
            eventCount: events.length,
            totalListeners,
            events: events.map(event => ({
                name: event,
                listenerCount: this.listenerCount(event)
            })),
            maxListeners: this.maxListeners
        };
    }

    /**
     * Cria um namespace isolado (para evitar conflitos)
     * @param {string} prefix - Prefixo para o namespace
     * @returns {EventEmitter} - Nova instância isolada
     */
    namespace(prefix) {
        const namespaced = new EventEmitter();
        namespaced.setMaxListeners(this.maxListeners);
        namespaced.setDebugMode(this.debugMode);

        // Proxy para adicionar prefixo automaticamente
        return new Proxy(namespaced, {
            get(target, prop) {
                if (prop === 'on' || prop === 'once' || prop === 'off' || prop === 'emit' || prop === 'emitAsync') {
                    return function(event, ...args) {
                        return target[prop](`${prefix}:${event}`, ...args);
                    };
                }
                return target[prop];
            }
        });
    }
}

/**
 * Instância global singleton do EventEmitter
 * Usar para comunicação entre módulos em toda a aplicação
 */
export const eventBus = new EventEmitter();

// Expor globalmente para compatibilidade com código legado
if (typeof window !== 'undefined') {
    window.eventBus = eventBus;
    window.EventEmitter = EventEmitter;
}

export default EventEmitter;
