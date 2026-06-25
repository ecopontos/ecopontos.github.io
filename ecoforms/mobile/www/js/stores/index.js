/**
 * Index file for stores
 * Centralizes all Alpine stores
 */

import { createFormStore } from './formStore.js';
import { createDataStore } from './dataStore.js';

// Export for module usage
export { createFormStore, createDataStore };

// Auto-register stores when Alpine is available
if (typeof window !== 'undefined') {
    document.addEventListener('alpine:init', () => {
        if (window.Alpine && typeof window.Alpine.store === 'function') {
            window.Alpine.store('form', createFormStore());
            window.Alpine.store('data', createDataStore());
            console.log('✅ All stores registered successfully');
        }
    });
}
