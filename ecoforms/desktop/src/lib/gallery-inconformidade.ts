import { uuidv7 } from 'ecoforms-core';

export interface GalleryInconformidadeEntry {
    id_foto: string;
    imagem: string;
    criado_em: string;
    inconformidades: string[];
    observacao: string;
}

export interface QueuedPhoto {
    localId: string;
    imagemBase64: string;
}

/** Ephemeral id for an in-progress queue item — never persisted. Not a UUID v7: the Global Constraint requiring UUID v7 applies to persisted ids like id_foto, generated below via uuidv7(). */
export function makeLocalId(): string {
    return `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildEntriesFromQueue(
    queue: QueuedPhoto[],
    inconformidades: string[],
    observacao: string,
): GalleryInconformidadeEntry[] {
    const criadoEm = new Date().toISOString();
    return queue.map((foto) => ({
        id_foto: uuidv7(),
        imagem: foto.imagemBase64,
        criado_em: criadoEm,
        inconformidades: [...inconformidades],
        observacao,
    }));
}

export function applyQueueSave(
    existing: GalleryInconformidadeEntry[],
    editingId: string | null,
    newEntries: GalleryInconformidadeEntry[],
): GalleryInconformidadeEntry[] {
    const base = editingId
        ? existing.filter((e) => e.id_foto !== editingId)
        : existing;
    return [...base, ...newEntries];
}
