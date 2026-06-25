const { getSupabaseClient } = require('./supabase-client');

class SupabaseMcpConnector {
  constructor() {
    this.tables = new Set();
    this.supabase = null;
  }

  async initialize() {
    this.supabase = await getSupabaseClient();
    return this;
  }

  registerTable(tableName) {
    this.tables.add(tableName);
    return this;
  }

  async getContextData(tableName, filter = {}) {
    if (!this.tables.has(tableName)) {
      throw new Error(`Table "${tableName}" not registered for MCP access`);
    }

    const filePath = `shared/${tableName}.json`;
    
    const { data: fileData, error } = await this.supabase.storage
      .from('sync-bucket')
      .download(filePath);

    if (error) {
      throw new Error(`Failed to fetch data from ${tableName}: ${error.message}`);
    }

    const text = await fileData.text();
    const snapshot = JSON.parse(text);
    let data = snapshot.data || snapshot[tableName] || snapshot;
    
    if (!Array.isArray(data)) {
      data = [data];
    }

    // Apply filters client-side
    Object.entries(filter).forEach(([key, value]) => {
      data = data.filter(item => item[key] === value);
    });

    return data;
  }

  async handleMcpContextRequest(request) {
    const { tableName, filter } = request.body;
    return this.getContextData(tableName, filter);
  }
}

module.exports = { SupabaseMcpConnector };
