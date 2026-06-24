import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
});

// Parse raw body for upload endpoint (application/json or application/octet-stream)
app.use(express.raw({ type: '*/*', limit: '20mb' }));

// Serve static files from www
app.use('/', express.static(path.join(__dirname, 'www')));

// Simple health route
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// API: Generate signed download URL or upload via proxy using SUPABASE_SERVICE_ROLE_KEY
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE;
const bucketName = process.env.SUPABASE_BUCKET || 'suite';
const API_KEY = process.env.API_KEY || process.env.ECOFORMS_API_KEY;

let serverSupabase = null;
if (supabaseUrl && serviceRoleKey) {
    serverSupabase = createClient(supabaseUrl, serviceRoleKey);
} else {
    if (!serviceRoleKey) console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not configured - /api/upload and /api/signed-url will be disabled');
}

// In-memory rate limiter (per IP)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const record = rateLimitMap.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

    if (now > record.resetAt) {
        record.count = 0;
        record.resetAt = now + RATE_LIMIT_WINDOW_MS;
    }

    record.count++;
    rateLimitMap.set(ip, record);

    if (record.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
}

// Apply rate limiting to all /api/* routes
app.use('/api', rateLimit);

// Simple API key auth for sensitive endpoints
function requireApiKey(req, res, next) {
    if (!API_KEY) {
        console.warn('⚠️ API_KEY not configured — /api/upload and /api/signed-url are disabled');
        return res.status(503).json({ error: 'Server API key not configured' });
    }
    const provided = req.headers['x-api-key'] || req.query.api_key;
    if (provided !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized: invalid or missing API key' });
    }
    next();
}

function sanitizeFilePath(input) {
    if (typeof input !== 'string') return '';
    // Remove null bytes, directory traversal, and leading slashes
    return input.replace(/\0/g, '').replace(/\.\./g, '').replace(/^\/+/g, '');
}

app.get('/api/signed-url', requireApiKey, async (req, res) => {
    try {
        if (!serverSupabase) return res.status(500).json({ error: 'Server Supabase client not configured' });
        const filePath = sanitizeFilePath(req.query.path);
        const op = req.query.op || 'download';
        const expires = Math.min(parseInt(req.query.expires, 10) || 60, 3600); // max 1 hour
        if (!filePath) return res.status(400).json({ error: 'Missing path query parameter' });

        // Only download signed URLs are supported here
        if (op === 'download') {
            const { data, error } = await serverSupabase.storage.from(bucketName).createSignedUrl(filePath, expires);
            if (error) return res.status(500).json({ error: error.message || error });
            return res.json({ url: data.signedUrl });
        }

        return res.status(400).json({ error: 'Unsupported op' });
    } catch (err) {
        console.error('Error /api/signed-url', err);
        return res.status(500).json({ error: String(err) });
    }
});

// POST /api/upload?path=...   -> body is raw file content
app.post('/api/upload', requireApiKey, async (req, res) => {
    try {
        if (!serverSupabase) return res.status(500).json({ error: 'Server Supabase client not configured' });
        const filePath = sanitizeFilePath(req.query.path);
        if (!filePath) return res.status(400).json({ error: 'Missing path query parameter' });

        // Block executable-like uploads by extension
        const lowerPath = filePath.toLowerCase();
        const blockedExts = ['.exe', '.bat', '.cmd', '.sh', '.php', '.jsp', '.asp'];
        if (blockedExts.some(ext => lowerPath.endsWith(ext))) {
            return res.status(400).json({ error: 'Upload of executable files is not allowed' });
        }

        // req.body is a Buffer because of express.raw
        const contentType = req.headers['content-type'] || 'application/octet-stream';
        const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''));

        // Upload using server-side client (service role)
        const { error } = await serverSupabase.storage.from(bucketName).upload(filePath, buffer, { upsert: true, contentType });
        if (error) return res.status(500).json({ error: error.message || error });

        return res.json({ success: true, path: filePath });
    } catch (err) {
        console.error('Error /api/upload', err);
        return res.status(500).json({ error: String(err) });
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`🚀 EcoForms server running on http://localhost:${PORT}`);
});