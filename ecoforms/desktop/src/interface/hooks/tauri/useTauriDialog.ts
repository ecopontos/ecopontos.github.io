import { useMemo } from 'react';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';

/**
 * Encapsula o plugin Tauri de diálogos para a camada de UI.
 * Mantém os imports de `@tauri-apps/*` confinados a src/interface/.
 */
export function useTauriDialog() {
    return useMemo(() => ({
        open: openDialog,
        save: saveDialog,
    }), []);
}

/** Para event handlers (não-hooks) que precisam abrir diálogo de arquivo diretamente. */
export { openDialog, saveDialog };
