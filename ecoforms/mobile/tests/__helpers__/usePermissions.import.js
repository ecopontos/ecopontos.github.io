// Helper to import desktop usePermissions module using alias
export function importUsePermissions() {
  // Use the @desktop alias defined in vitest.config.js
  return import('@desktop/src/interface/hooks/utils/usePermissions');
} 
