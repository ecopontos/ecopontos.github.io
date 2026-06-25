import { useMemo } from 'react';
import {
    readTextFile,
    writeTextFile,
    readFile,
    writeFile,
    exists,
    mkdir,
    remove,
} from '@tauri-apps/plugin-fs';

/**
 * Encapsula o plugin Tauri de filesystem para a camada de UI.
 * Mantém os imports de `@tauri-apps/*` confinados a src/interface/.
 */
export function useTauriFs() {
    return useMemo(() => ({
        readTextFile,
        writeTextFile,
        readFile,
        writeFile,
        exists,
        mkdir,
        remove,
    }), []);
}
