/**
 * PerformanceMonitor - Sistema de métricas e monitoramento de performance
 * Instrumenta renderização de formulários com métricas detalhadas
 * 
 * Métricas capturadas:
 * - First Contentful Paint (FCP)
 * - Time to Interactive (TTI)
 * - Field render times
 * - Memory usage
 * - Frame rate (FPS)
 * - Long tasks
 * 
 * @example
 * const monitor = new PerformanceMonitor();
 * monitor.startMonitoring();
 * 
 * // ... renderizar formulário ...
 * 
 * const metrics = monitor.getMetrics();
 * console.log('FCP:', metrics.fcp);
 */

import { eventBus } from './EventEmitter.js';

export class PerformanceMonitor {
    constructor(options = {}) {
        this.options = {
            enabled: true,
            trackMemory: true,
            trackFPS: true,
            trackLongTasks: true,
            longTaskThreshold: 50, // ms
            fpsInterval: 1000, // ms
            ...options
        };

        this.metrics = {
            fcp: null,
            lcp: null,
            tti: null,
            fieldRenders: [],
            longTasks: [],
            fps: [],
            memory: [],
            totalRenderTime: 0,
            averageFieldTime: 0,
            slowestField: null,
            fastestField: null
        };

        this.observers = [];
        this.timers = [];
        this.rafId = null;

        this.initialize();
    }

    /**
     * Inicializa o monitor
     */
    initialize() {
        if (!this.options.enabled) return;

        // Performance Observer para Core Web Vitals
        this.setupPerformanceObserver();

        // FPS tracking
        if (this.options.trackFPS) {
            this.setupFPSTracking();
        }

        // Memory tracking
        if (this.options.trackMemory && typeof performance.memory !== 'undefined') {
            this.setupMemoryTracking();
        }

        // Long tasks
        if (this.options.trackLongTasks) {
            this.setupLongTaskTracking();
        }

        // Event listeners
        eventBus.on('fieldRendered', (payload) => this.onFieldRendered(payload));
        eventBus.on('progressiveRenderCompleted', (payload) => this.onRenderCompleted(payload));
    }

    /**
     * Configura PerformanceObserver
     */
    setupPerformanceObserver() {
        if (typeof PerformanceObserver === 'undefined') {
            console.warn('PerformanceObserver não suportado');
            return;
        }

        try {
            // First Contentful Paint
            const paintObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.name === 'first-contentful-paint') {
                        this.metrics.fcp = entry.startTime;
                        console.log(`📊 FCP: ${entry.startTime.toFixed(2)}ms`);
                    }
                }
            });
            paintObserver.observe({ entryTypes: ['paint'] });
            this.observers.push(paintObserver);

            // Largest Contentful Paint
            const lcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                this.metrics.lcp = lastEntry.renderTime || lastEntry.loadTime;
                console.log(`📊 LCP: ${this.metrics.lcp.toFixed(2)}ms`);
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            this.observers.push(lcpObserver);

            // Long Tasks
            if (this.options.trackLongTasks) {
                const longTaskObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        this.metrics.longTasks.push({
                            duration: entry.duration,
                            startTime: entry.startTime,
                            name: entry.name
                        });

                        if (entry.duration > this.options.longTaskThreshold) {
                            console.warn(`⚠️ Long Task detected: ${entry.duration.toFixed(2)}ms`);
                            eventBus.emit('longTaskDetected', {
                                duration: entry.duration,
                                startTime: entry.startTime
                            });
                        }
                    }
                });
                longTaskObserver.observe({ entryTypes: ['longtask'] });
                this.observers.push(longTaskObserver);
            }

        } catch (error) {
            console.error('Erro ao configurar PerformanceObserver:', error);
        }
    }

    /**
     * Configura tracking de FPS
     */
    setupFPSTracking() {
        let lastTime = performance.now();
        let frames = 0;

        const trackFrame = () => {
            frames++;
            const currentTime = performance.now();
            const elapsed = currentTime - lastTime;

            if (elapsed >= this.options.fpsInterval) {
                const fps = Math.round((frames * 1000) / elapsed);
                this.metrics.fps.push({
                    timestamp: currentTime,
                    fps
                });

                // Manter apenas últimos 60 registros
                if (this.metrics.fps.length > 60) {
                    this.metrics.fps.shift();
                }

                frames = 0;
                lastTime = currentTime;
            }

            this.rafId = requestAnimationFrame(trackFrame);
        };

        this.rafId = requestAnimationFrame(trackFrame);
    }

    /**
     * Configura tracking de memória
     */
    setupMemoryTracking() {
        const trackMemory = () => {
            if (performance.memory) {
                this.metrics.memory.push({
                    timestamp: Date.now(),
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                });

                // Manter apenas últimas 60 medições
                if (this.metrics.memory.length > 60) {
                    this.metrics.memory.shift();
                }
            }
        };

        // Capturar a cada 2 segundos
        const memoryInterval = setInterval(trackMemory, 2000);
        this.timers.push(memoryInterval);

        // Captura inicial
        trackMemory();
    }

    /**
     * Configura tracking de long tasks (fallback)
     */
    setupLongTaskTracking() {
        // Já configurado no PerformanceObserver, este é apenas fallback
        let taskStart = null;

        const beforeTask = () => {
            taskStart = performance.now();
        };

        const afterTask = () => {
            if (taskStart) {
                const duration = performance.now() - taskStart;
                
                if (duration > this.options.longTaskThreshold) {
                    this.metrics.longTasks.push({
                        duration,
                        startTime: taskStart,
                        name: 'manual-tracking'
                    });
                }

                taskStart = null;
            }
        };

        // Hooks para tracking manual (se necessário)
        this.beforeTask = beforeTask;
        this.afterTask = afterTask;
    }

    /**
     * Inicia monitoramento de uma operação
     * @param {string} name - Nome da operação
     * @returns {Function} - Função para finalizar medição
     */
    startMeasure(name) {
        const startTime = performance.now();
        const startMark = `${name}-start`;
        
        performance.mark(startMark);

        return () => {
            const endTime = performance.now();
            const endMark = `${name}-end`;
            const measureName = name;

            performance.mark(endMark);
            performance.measure(measureName, startMark, endMark);

            const duration = endTime - startTime;

            // Limpar marks
            performance.clearMarks(startMark);
            performance.clearMarks(endMark);

            return duration;
        };
    }

    /**
     * Callback quando campo é renderizado
     */
    onFieldRendered(payload) {
        const { fieldId, type } = payload;

        // Obter timing do performance.measure se disponível
        const entries = performance.getEntriesByName(fieldId);
        const duration = entries.length > 0 ? entries[entries.length - 1].duration : 0;

        const record = {
            fieldId,
            type,
            duration,
            timestamp: Date.now()
        };

        this.metrics.fieldRenders.push(record);
        this.updateFieldStats(record);
    }

    /**
     * Callback quando renderização completa
     */
    onRenderCompleted(payload) {
        console.log('📊 Renderização completa - métricas:', payload);

        // Calcular TTI (Time to Interactive) - aproximação
        if (this.metrics.longTasks.length === 0) {
            this.metrics.tti = payload.renderTime || 0;
        } else {
            const lastLongTask = this.metrics.longTasks[this.metrics.longTasks.length - 1];
            this.metrics.tti = lastLongTask.startTime + lastLongTask.duration;
        }

        eventBus.emit('performanceMetricsReady', this.getMetrics());
    }

    /**
     * Atualiza estatísticas de campos
     */
    updateFieldStats(record) {
        const { duration } = record;

        // Tempo total
        this.metrics.totalRenderTime += duration;

        // Média
        this.metrics.averageFieldTime = 
            this.metrics.totalRenderTime / this.metrics.fieldRenders.length;

        // Mais lento
        if (!this.metrics.slowestField || duration > this.metrics.slowestField.duration) {
            this.metrics.slowestField = record;
        }

        // Mais rápido
        if (!this.metrics.fastestField || duration < this.metrics.fastestField.duration) {
            this.metrics.fastestField = record;
        }
    }

    /**
     * Obtém métricas atuais
     */
    getMetrics() {
        const currentFPS = this.getCurrentFPS();
        const currentMemory = this.getCurrentMemory();

        return {
            // Core Web Vitals
            fcp: this.metrics.fcp,
            lcp: this.metrics.lcp,
            tti: this.metrics.tti,

            // Field rendering
            totalFields: this.metrics.fieldRenders.length,
            totalRenderTime: this.metrics.totalRenderTime,
            averageFieldTime: this.metrics.averageFieldTime,
            slowestField: this.metrics.slowestField,
            fastestField: this.metrics.fastestField,

            // Performance
            currentFPS,
            averageFPS: this.getAverageFPS(),
            longTaskCount: this.metrics.longTasks.length,
            totalLongTaskTime: this.metrics.longTasks.reduce((sum, t) => sum + t.duration, 0),

            // Memory
            currentMemory,
            peakMemory: this.getPeakMemory(),

            // Raw data
            fieldRenders: this.metrics.fieldRenders,
            longTasks: this.metrics.longTasks,
            fps: this.metrics.fps,
            memory: this.metrics.memory
        };
    }

    /**
     * Obtém FPS atual
     */
    getCurrentFPS() {
        if (this.metrics.fps.length === 0) return null;
        return this.metrics.fps[this.metrics.fps.length - 1].fps;
    }

    /**
     * Obtém FPS médio
     */
    getAverageFPS() {
        if (this.metrics.fps.length === 0) return null;
        
        const sum = this.metrics.fps.reduce((acc, entry) => acc + entry.fps, 0);
        return Math.round(sum / this.metrics.fps.length);
    }

    /**
     * Obtém memória atual
     */
    getCurrentMemory() {
        if (this.metrics.memory.length === 0) return null;
        
        const latest = this.metrics.memory[this.metrics.memory.length - 1];
        return {
            used: (latest.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
            total: (latest.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
            limit: (latest.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
        };
    }

    /**
     * Obtém pico de memória
     */
    getPeakMemory() {
        if (this.metrics.memory.length === 0) return null;

        const peak = Math.max(...this.metrics.memory.map(m => m.usedJSHeapSize));
        return (peak / 1048576).toFixed(2) + ' MB';
    }

    /**
     * Gera relatório de performance
     */
    generateReport() {
        const metrics = this.getMetrics();

        const report = {
            summary: {
                fcp: metrics.fcp ? `${metrics.fcp.toFixed(2)}ms` : 'N/A',
                lcp: metrics.lcp ? `${metrics.lcp.toFixed(2)}ms` : 'N/A',
                tti: metrics.tti ? `${metrics.tti.toFixed(2)}ms` : 'N/A',
                totalFields: metrics.totalFields,
                avgFieldTime: `${metrics.averageFieldTime.toFixed(2)}ms`,
                currentFPS: metrics.currentFPS || 'N/A',
                avgFPS: metrics.averageFPS || 'N/A'
            },
            rendering: {
                total: metrics.totalFields,
                totalTime: `${metrics.totalRenderTime.toFixed(2)}ms`,
                average: `${metrics.averageFieldTime.toFixed(2)}ms`,
                slowest: metrics.slowestField ? {
                    field: metrics.slowestField.fieldId,
                    time: `${metrics.slowestField.duration.toFixed(2)}ms`
                } : null,
                fastest: metrics.fastestField ? {
                    field: metrics.fastestField.fieldId,
                    time: `${metrics.fastestField.duration.toFixed(2)}ms`
                } : null
            },
            performance: {
                longTasks: metrics.longTaskCount,
                longTaskTime: `${metrics.totalLongTaskTime.toFixed(2)}ms`,
                currentFPS: metrics.currentFPS,
                averageFPS: metrics.averageFPS
            },
            memory: {
                current: metrics.currentMemory,
                peak: metrics.peakMemory
            },
            recommendations: this.generateRecommendations(metrics)
        };

        return report;
    }

    /**
     * Gera recomendações baseadas nas métricas
     */
    generateRecommendations(metrics) {
        const recommendations = [];

        // FCP alto
        if (metrics.fcp && metrics.fcp > 2000) {
            recommendations.push({
                type: 'warning',
                metric: 'FCP',
                message: 'First Contentful Paint está alto. Considere carregamento progressivo.',
                value: `${metrics.fcp.toFixed(2)}ms`
            });
        }

        // Campos lentos
        if (metrics.averageFieldTime > 50) {
            recommendations.push({
                type: 'warning',
                metric: 'Field Render Time',
                message: 'Tempo médio de renderização de campos está alto. Ative memoização.',
                value: `${metrics.averageFieldTime.toFixed(2)}ms`
            });
        }

        // Long tasks
        if (metrics.longTaskCount > 10) {
            recommendations.push({
                type: 'error',
                metric: 'Long Tasks',
                message: 'Muitas long tasks detectadas. Use chunking ou virtualização.',
                value: metrics.longTaskCount
            });
        }

        // FPS baixo
        if (metrics.averageFPS && metrics.averageFPS < 30) {
            recommendations.push({
                type: 'error',
                metric: 'FPS',
                message: 'Frame rate baixo. Reduza complexidade da renderização.',
                value: metrics.averageFPS
            });
        }

        // Memória alta
        if (metrics.currentMemory) {
            const usedMB = parseFloat(metrics.currentMemory.used);
            if (usedMB > 100) {
                recommendations.push({
                    type: 'warning',
                    metric: 'Memory',
                    message: 'Uso alto de memória. Considere virtualização ou unload de seções.',
                    value: metrics.currentMemory.used
                });
            }
        }

        if (recommendations.length === 0) {
            recommendations.push({
                type: 'success',
                message: 'Performance está ótima! 🎉'
            });
        }

        return recommendations;
    }

    /**
     * Exporta métricas para JSON
     */
    exportMetrics() {
        return JSON.stringify(this.getMetrics(), null, 2);
    }

    /**
     * Reseta métricas
     */
    reset() {
        this.metrics = {
            fcp: null,
            lcp: null,
            tti: null,
            fieldRenders: [],
            longTasks: [],
            fps: [],
            memory: [],
            totalRenderTime: 0,
            averageFieldTime: 0,
            slowestField: null,
            fastestField: null
        };
    }

    /**
     * Para monitoramento
     */
    stopMonitoring() {
        // Cancelar RAF
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        // Limpar timers
        this.timers.forEach(timer => clearInterval(timer));
        this.timers = [];

        // Desconectar observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
    }

    /**
     * Destrói o monitor
     */
    destroy() {
        this.stopMonitoring();
        this.reset();
        eventBus.off('fieldRendered');
        eventBus.off('progressiveRenderCompleted');
    }
}

export default PerformanceMonitor;
