/**
 * Minimal Model Context Protocol (MCP) test server with Supabase integration
 * - GET /mcp -> returns a simple manifest
 * - POST /context -> can fetch data from Supabase when payload requests it
 */
require('dotenv').config({ path: './.env' });
const http = require('http');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Supabase client initialized');
  } catch (e) {
    console.warn('Failed to initialize Supabase client:', e.message);
  }
} else {
  console.warn('SUPABASE_URL or SUPABASE_ANON_KEY not set — Supabase integration disabled.');
}

const PORT = process.env.PORT || 5174;

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/mcp') {
    const manifest = {
      name: 'meu-mcp-test',
      version: '0.2.0',
      models: [
        {
          name: 'test-model',
          description: 'Modelo de teste simples',
          inputs: [{ name: 'prompt', type: 'string' }]
        }
      ],
      endpoints: {
        context: '/context'
      },
      supabase: !!supabase
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(manifest));
    return;
  }

  if (req.method === 'POST' && req.url === '/context') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      let payload;
      try {
        payload = JSON.parse(body || '{}');
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid json' }));
        return;
      }

      // If payload requests data from Supabase Storage, try to fetch it
      if (supabase && payload.fromStorage) {
        const filePath = payload.fromStorage;
        try {
          const { data, error } = await supabase.storage
            .from('sync-bucket')
            .download(filePath);

          if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'supabase_storage_error', details: error }));
            return;
          }

          const text = await data.text();
          const jsonData = JSON.parse(text);

          const response = {
            model: payload.model || 'test-model',
            input: payload,
            sourceData: data,
            output: `Fetched ${Array.isArray(data) ? data.length : 1} row(s) from ${table}`
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(response));
          return;
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'supabase_exception', message: e.message }));
          return;
        }
      }

      // Otherwise fallback to echo behavior
      const response = {
        model: payload.model || 'test-model',
        input: payload,
        output: `Echo: ${JSON.stringify(payload)}`
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log(`MCP test server listening on http://localhost:${PORT}`);
  console.log('GET /mcp -> manifest');
  console.log('POST /context -> fetch data from Supabase when payload.fromTable is set');
});
