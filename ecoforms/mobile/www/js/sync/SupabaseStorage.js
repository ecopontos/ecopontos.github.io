const DEFAULT_BUCKET = 'sync-bucket';

export class SupabaseStorage {
  constructor(bucket = DEFAULT_BUCKET) {
    this.bucket = bucket;
  }

  getClient() {
    const client = window.globalSupabaseClient;
    if (!client) throw new Error('Supabase client não inicializado');
    return client;
  }

  async upload(path, data, contentType) {
    const client = this.getClient();
    const { error } = await client.storage.from(this.bucket).upload(path, data, {
      contentType,
      upsert: true,
    });
    if (error) throw error;
    return { path };
  }

  async download(path) {
    const client = this.getClient();
    const { data, error } = await client.storage.from(this.bucket).download(path);
    if (error) throw error;
    return data;
  }

  async list(prefix) {
    const client = this.getClient();
    const { data, error } = await client.storage.from(this.bucket).list(prefix);
    if (error) throw error;
    return (data || []).map(f => f.name);
  }

  async remove(paths) {
    const client = this.getClient();
    const { error } = await client.storage.from(this.bucket).remove(paths);
    if (error) throw error;
  }

  async ensureBucket() {
    const client = this.getClient();
    const { error: listErr } = await client.storage.from(this.bucket).list('', { limit: 1 });
    if (!listErr) return { ok: true };

    const { error: createErr } = await client.storage.createBucket(this.bucket, {
      public: false,
      fileSizeLimit: 52428800,
    });

    if (!createErr) return { ok: true };
    if (createErr.message?.toLowerCase().includes('already exist')) return { ok: true };
    return { ok: false, reason: createErr.message };
  }
}
