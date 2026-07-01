import { useState, useCallback } from 'react';
import { uuidv7 } from 'ecoforms-core';
import { getContainerAsync } from '../utils/useContainer';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@/src/interface/hooks/catalog/tauri';
import type { Anexo } from '@/src/domain/ouvidoria/ManifestacaoRepository';

export function useAnexoUpload() {
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(async (manifestacaoId: string): Promise<Anexo | null> => {
    setUploading(true);
    try {
      const selected = await open({ multiple: false });
      if (!selected || Array.isArray(selected)) return null;

      const fileName = selected.split(/[\\/]/).pop() || 'arquivo';
      const destName = `${uuidv7()}-${fileName}`;
      const copied = await invoke<{ fileName: string; storagePath: string; mimeType?: string }>('copy_attachment_to_appdata', {
        sourcePath: selected,
        destName,
      });

      const anexo: Anexo = {
        id: uuidv7(),
        manifestacaoId,
        nomeArquivo: copied.fileName,
        storagePath: copied.storagePath,
        mimeType: copied.mimeType,
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
