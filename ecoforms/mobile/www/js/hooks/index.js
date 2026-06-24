/**
 * Index file for hooks
 * Centralizes all hook utilities
 */

export { useDataRegistry, useDataStore } from './useDataRegistry.js';
export { useFieldOptions, getFieldOptions } from './useFieldOptions.js';

// Make hooks available globally for non-module usage
if (typeof window !== 'undefined') {
    import('./useDataRegistry.js').then(module => {
        window.useDataRegistry = module.useDataRegistry;
        window.useDataStore = module.useDataStore;
    });

    import('./useFieldOptions.js').then(module => {
        window.useFieldOptions = module.useFieldOptions;
        window.getFieldOptions = module.getFieldOptions;
    });
}
