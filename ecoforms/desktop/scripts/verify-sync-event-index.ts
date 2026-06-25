/**
 * ADR-056 §8 — verificação standalone do encoding BYTEA via hex (\x...)
 * para as RPCs rpc_push_sync_event / rpc_pull_sync_events.
 *
 * Roda com: npx ts-node scripts/verify-sync-event-index.ts
 *
 * Pré-requisito: a migração desktop/supabase/migrations/05-sync-event-index.sql
 * já deve ter sido aplicada no projeto Supabase (.env.local aponta para ele).
 *
 * Usa a anon key (mesmo caminho que o mobile usa) — confirma que `anon`
 * tem EXECUTE nas duas RPCs e que o roundtrip de bytes é fiel.
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal(): Record<string, string> {
    const envPath = path.resolve(__dirname, '../.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const env: Record<string, string> = {};
    for (const line of content.split('\n')) {
        const idx = line.indexOf('=');
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (key && value) env[key] = value;
    }
    return env;
}

function bytesToPgHex(bytes: Uint8Array): string {
    let hex = '\\x';
    for (const b of bytes) hex += b.toString(16).padStart(2, '0');
    return hex;
}

function pgHexToBytes(hex: string): Uint8Array {
    const clean = hex.startsWith('\\x') ? hex.slice(2) : hex;
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
    }
    return bytes;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

async function main() {
    const env = loadEnvLocal();
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const routingId = '_verify_sync_event_index';
    const payload = randomBytes(64);
    const id = randomUUID();

    console.log(`🔄 rpc_push_sync_event (routing_id=${routingId}, id=${id}, payload=${payload.length} bytes)...`);

    const { data: pushedSeq, error: pushError } = await supabase.rpc('rpc_push_sync_event', {
        p_id: id,
        p_routing_id: routingId,
        p_routing_type: 'setor',
        p_event_type: 'task.criada',
        p_aggregate_type: 'verify',
        p_aggregate_id: id,
        p_device_id: 'verify-script',
        p_checksum: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        p_prev_event_id: null,
        p_payload_enc: bytesToPgHex(payload),
    });

    if (pushError) {
        console.error('❌ rpc_push_sync_event falhou:', pushError);
        process.exit(1);
    }
    console.log(`✅ push OK — seq=${pushedSeq}`);

    console.log(`🔄 rpc_pull_sync_events (since_seq=0)...`);
    const { data: rows, error: pullError } = await supabase.rpc('rpc_pull_sync_events', {
        p_routing_id: routingId,
        p_since_seq: 0,
        p_limit: 50,
    });

    if (pullError) {
        console.error('❌ rpc_pull_sync_events falhou:', pullError);
        process.exit(1);
    }

    const row = (rows as Array<{ id: string; seq: number; payload_enc: string }> | null)?.find(r => r.id === id);
    if (!row) {
        console.error('❌ Evento não encontrado no pull. Rows recebidas:', rows);
        process.exit(1);
    }

    console.log(`✅ pull OK — seq=${row.seq}, payload_enc (raw)=${String(row.payload_enc).slice(0, 20)}...`);

    const recovered = pgHexToBytes(String(row.payload_enc));
    const match = bytesEqual(payload, recovered);

    if (!match) {
        console.error('❌ FAIL — bytes recuperados não batem com o original');
        console.error('   original :', Buffer.from(payload).toString('hex'));
        console.error('   recovered:', Buffer.from(recovered).toString('hex'));
        process.exit(1);
    }

    console.log('✅ PASS — roundtrip de bytes via BYTEA hex (\\x) é fiel');
}

main().catch(err => {
    console.error('❌ Erro inesperado:', err);
    process.exit(1);
});
