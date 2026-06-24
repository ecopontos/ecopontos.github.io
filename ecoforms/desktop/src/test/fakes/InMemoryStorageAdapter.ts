export class InMemoryStorageAdapter {
    private store = new Map<string, Uint8Array>();

    async upload(path: string, data: Uint8Array | Blob | ArrayBuffer): Promise<void> {
        let bytes: Uint8Array;
        if (data instanceof Blob) {
            bytes = new Uint8Array(await data.arrayBuffer());
        } else if (data instanceof ArrayBuffer) {
            bytes = new Uint8Array(data);
        } else {
            bytes = data;
        }
        this.store.set(path, bytes);
    }

    async download(path: string): Promise<Blob> {
        const data = this.store.get(path);
        if (!data) throw new Error(`Arquivo não encontrado: ${path}`);
        return new Blob([new Uint8Array(data.buffer) as BlobPart]);
    }

    async list(prefix: string): Promise<string[]> {
        return Array.from(this.store.keys()).filter(k => k.startsWith(prefix));
    }

    async delete(path: string): Promise<void> {
        this.store.delete(path);
    }

    clear(): void {
        this.store.clear();
    }
}