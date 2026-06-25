import { useState, useCallback } from 'react';
import { uuidv7 } from 'ecoforms-core';
import { getContainerAsync } from '@/src/infrastructure/container';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile, writeFile, mkdir } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import type { Anexo } from '@/src/domain/ouvidoria/ManifestacaoRepository';

export function useAnexoUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(async (manifestacaoId: string): Promise<Anexo | null> => {
    setUploading(true);
    try {
      const selected = await open({ multiple: false });
      if (!selected || Array.isArray(selected)) return null;

      const fileName = selected.split(/[\\/]/).pop() || 'arquivo';
      const bytes = await readFile(selected);

      const appDir = await appDataDir();
      const anexosDir = await join(appDir, 'anexos');
      try { await mkdir(anexosDir); } catch { /* já existe */ }

      const destName = `${uuidv7()}-${fileName}`;
      const destPath = await join(anexosDir, destName);
      await writeFile(destPath, new Uint8Array(bytes));

      const ext = fileName.split('.').pop();
      const anexo: Anexo = {
        id: uuidv7(),
        manifestacaoId,
        nomeArquivo: fileName,
        storagePath: destPath,
        mimeType: ext ? `application/${ext}` : undefined,
        criadoEm: new Date().toISOString(),
      };

      const c = await getContainerAsync();
      await c.manifestacaoRepository.addAnexo(anexo);
      return anexo;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading };
}
