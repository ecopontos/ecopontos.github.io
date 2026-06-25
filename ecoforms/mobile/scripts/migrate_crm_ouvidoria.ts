/**
 * Carga Zero: Migração Transacional do Legado Relacional (CRM / Ouvidoria)
 * Destino: suite (como pacotes JSON estritos) e dim_cliente.
 * 
 * Uso Opcional em Node (ts-node):
 * npx ts-node scripts/migrate_crm_ouvidoria.ts
 */

import sqlite3 from 'sqlite3';
import { join } from 'path';

const DB_LEGACY_PATH = join(process.cwd(), 'desktop', 'ecoforms_local_desktop.db');

const db = new sqlite3.Database(DB_LEGACY_PATH);

function run(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

async function migrateDimensions() {
    console.log('🔄 Extracão de Dimensões Estáveis e conversão relacional...');

    // Migrar Cliente (pjuridicas) para dim_cliente
    const clientesLegacy = await all(`SELECT id_legacy, Cliente, Inativo, Telefone, "Telefone 2" FROM pjuridicas`);
    console.log(`[dim_cliente] ${clientesLegacy.length} PJs sendo convertidas para dimensão.`);
    
    for (const c of clientesLegacy) {
        const payload = {
            id_legacy: c.id_legacy,
            nome: c.Cliente,
            inativo: c.Inativo,
            telefone: c.Telefone,
            telefone2: c["Telefone 2"]
        };
        await run(
            `INSERT INTO dim_cliente (id_legacy, nome, tipo, inativo, payload) VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(id_legacy) DO UPDATE SET payload=excluded.payload`,
            [c.id_legacy, c.Cliente, 'PJ', c.Inativo || 0, JSON.stringify(payload)]
        );
    }
}

async function migratePackages() {
    console.log('🔄 Traduzindo Ouvidoria (protocolo) para suite JSON packages...');
    
    const protocolos = await all(`
        SELECT p.*,
               pj.Cliente AS manifesto_nome
        FROM protocolo p
        LEFT JOIN pjuridicas pj ON p.PJ = pj.id_legacy
    `);

    console.log(`[suite] Encontrados ${protocolos.length} protocolos velhos.`);

    let errors = 0, success = 0;
    for (const pt of protocolos) {
        try {
            // O pacote autocontido (Contract)
            const suitePkg = {
                envelope: {
                    id: pt.id || `legacy_protocol_${pt.Protocolo}`,
                    tipo: 'protocolo',
                    dono: pt.usuario, // Assuming
                    estado: pt.Status === 'Encerrado' ? 'closed' : 'current',
                    versao: 1,
                    criado_em: pt.Carimbo || new Date().toISOString(),
                    atualizado_em: pt.DataFinalizacao || pt.Carimbo
                },
                payload: {
                    snapshot_dims: {
                        cliente: { nome: pt.manifesto_nome, legacy_id: pt.PJ },
                        assunto: { categoria: pt.AssuntoPrincipal }
                    },
                    classificacao: {
                        gravidade: pt.Gravidade || 'media',
                        tema: pt.AssuntoPrincipal,
                        detalhes: pt.Descricao
                    }
                },
                execution: {
                    atribuido_para: pt.Setor_Despacho || null,
                    data_vencimento: pt.Previsao || null,
                    data_execucao: pt.DataFinalizacao || null
                },
                meta: {
                    criador_id: pt.usuario,
                    dispositivo_id: 'legacy_migration'
                }
            };

            await run(
                `INSERT INTO suite (
                    package_id, version_no, module_type, resource_type, status,
                    owner_id, is_current, payload_json, created_at, closed_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(package_id) DO NOTHING`,
                [
                    suitePkg.envelope.id,
                    1,
                    'ouvidoria',
                    'protocolo',
                    suitePkg.envelope.estado,
                    suitePkg.envelope.dono,
                    1,
                    JSON.stringify(suitePkg),
                    suitePkg.envelope.criado_em,
                    pt.DataFinalizacao || null
                ]
            );
            success++;
        } catch(e) {
            errors++;
        }
    }
    console.log(`✅ Carga legada encerrada. Sucesso: ${success} | Erros: ${errors}`);
}

async function main() {
    await migrateDimensions();
    await migratePackages();
    db.close();
}

main().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
