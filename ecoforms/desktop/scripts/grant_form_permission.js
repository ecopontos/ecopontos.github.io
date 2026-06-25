/**
 * Script: grant_form_permission.js
 *
 * Adiciona 'saidaVeoliaForm' em formularios_permitidos do usuário patiocvr
 * no SQLite local e faz push imediato do shared/users.json para o Storage.
 *
 * Uso:
 *   node desktop/scripts/grant_form_permission.js
 */

const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');

try {
    require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
} catch (e) {
    // env vars already set
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY precisam estar definidos.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const DB_PATH = 'c:/Users/marceloluiz.comcap/Desktop/ecoforms0/banco/ecoforms.sqlite';
const TARGET_USER_ID = '2556dc47-8f6c-45e4-9c06-2cbf675473c1';
const FORM_TO_GRANT = 'saidaVeoliaForm';
const BUCKET = 'sync-bucket';

function calculateChecksum(data) {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return `sha256:${hash.digest('hex')}`;
}

function buildSnapshot(dataObj, tableKey) {
    const checksum = calculateChecksum(dataObj);
    const snapshot = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        device_id: 'desktop-script',
        origin_device: 'desktop-script',
        sync_type: 'full',
        data: dataObj,
        metadata: {
            checksum,
            record_count: { [tableKey]: dataObj[tableKey]?.length || 0 },
            compressed: false,
            file_size_bytes: 0,
        },
    };
    const json = JSON.stringify(snapshot);
    snapshot.metadata.file_size_bytes = Buffer.byteLength(json);
    return JSON.stringify(snapshot);
}

async function uploadSnapshot(filename, dataObj, tableKey) {
    const filePath = `shared/${filename}`;
    const body = buildSnapshot(dataObj, tableKey);

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, body, { contentType: 'application/json', upsert: true });

    if (error) {
        console.error(`❌ Upload falhou para ${filePath}:`, error.message);
    } else {
        console.log(`✅ ${filePath} atualizado no Storage.`);
    }
}

const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('❌ Não foi possível abrir o banco:', err.message);
        process.exit(1);
    }
    console.log(`📂 Banco aberto: ${DB_PATH}`);
});

db.get(
    `SELECT id, username, formularios_permitidos FROM usuarios WHERE id = ?`,
    [TARGET_USER_ID],
    (err, row) => {
        if (err || !row) {
            console.error('❌ Usuário não encontrado:', err?.message);
            db.close();
            process.exit(1);
        }

        let forms = [];
        try {
            forms = typeof row.formularios_permitidos === 'string'
                ? JSON.parse(row.formularios_permitidos)
                : (row.formularios_permitidos || []);
        } catch (e) {
            forms = [];
        }

        console.log(`👤 Usuário: ${row.username} (${row.id})`);
        console.log(`📋 Permissões atuais:`, forms);

        if (forms.includes(FORM_TO_GRANT)) {
            console.log(`ℹ️  '${FORM_TO_GRANT}' já está nas permissões. Apenas re-publicando users.json.`);
            pushUsers();
            return;
        }

        forms.push(FORM_TO_GRANT);
        const updatedAt = new Date().toISOString();

        db.run(
            `UPDATE usuarios SET formularios_permitidos = ?, atualizado_em = ? WHERE id = ?`,
            [JSON.stringify(forms), updatedAt, TARGET_USER_ID],
            function (updateErr) {
                if (updateErr) {
                    console.error('❌ Falha ao atualizar permissões:', updateErr.message);
                    db.close();
                    process.exit(1);
                }
                console.log(`✅ Permissões atualizadas para:`, forms);
                pushUsers();
            }
        );
    }
);

function pushUsers() {
    db.all(
        `SELECT u.*, GROUP_CONCAT(us.setor_id) as setores_ids
         FROM usuarios u
         LEFT JOIN usuarios_setores us ON u.id = us.usuario_id
         GROUP BY u.id`,
        async (err, rows) => {
            if (err || !rows) {
                console.error('❌ Erro ao buscar usuários:', err?.message);
                db.close();
                return;
            }

            const processed = rows.map((u) => {
                let forms = [];
                try {
                    forms = typeof u.formularios_permitidos === 'string'
                        ? JSON.parse(u.formularios_permitidos)
                        : (u.formularios_permitidos || []);
                } catch (e) { forms = []; }

                return {
                    ...u,
                    formularios_permitidos: forms,
                    setores: u.setores_ids ? u.setores_ids.split(',') : [],
                };
            });

            console.log(`📡 Publicando ${processed.length} usuários no Storage...`);
            await uploadSnapshot('users.json', { usuarios: processed }, 'usuarios');

            db.close();
            console.log('✅ Concluído. Faça um syncAll no desktop para propagar via tasks.json também.');
        }
    );
}
