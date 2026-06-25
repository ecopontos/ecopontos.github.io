import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'ecoforms.sqlite');
const schemaPath = path.join(process.cwd(), 'desktop', 'schema_dump_clean.sql');

async function run() {
    console.log('🚀 Initializing database...');
    
    const db = new sqlite3.Database(dbPath);
    
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements (basic splitting by ;)
    // Note: This is a bit naive but should work for this dump
    const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
    
    db.serialize(() => {
        console.log('  Applying schema...');
        for (const statement of statements) {
            db.run(statement, (err) => {
                if (err && !err.message.includes('already exists')) {
                    // console.error('  Error executing statement:', err.message);
                }
            });
        }
        
        console.log('  Seeding data...');
        
        // 1. Seed Users
        const users = [
            ['admin-id', 'admin', 'hash', 'Administrador', 'admin', '[]', 1, 'Geral'],
            ['gerente-id', 'gerente', 'hash', 'Gerente Coleta', 'gerente', '[]', 1, 'Coleta'],
            ['ope-id', 'operador', 'hash', 'Operador 01', 'operador', '[]', 1, 'Educação']
        ];
        
        const userStmt = db.prepare("INSERT OR IGNORE INTO usuarios (id, username, password_hash, nome, perfil, formularios_permitidos, ativo, setor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        users.forEach(u => userStmt.run(u));
        userStmt.finalize();
        
        // 2. Seed Projects
        const projects = [
            ['proj-geral', 'Projeto Geral', 'Projeto padrão para tarefas avulsas', '#3B82F6', 'admin-id'],
            ['proj-recicla', 'Recicla Já', 'Programa de reciclagem comunitária', '#10B981', 'admin-id']
        ];
        const projStmt = db.prepare("INSERT OR IGNORE INTO projetos (id, nome, descricao, cor, criado_por) VALUES (?, ?, ?, ?, ?)");
        projects.forEach(p => projStmt.run(p));
        projStmt.finalize();
        
        // 3. Seed Solicitations (suite)
        const solicitations = [
            {
                tipo_form: 'solicitacaogeralform',
                user_id: 'gerente-id',
                dados: JSON.stringify({
                    campos: {
                        tipo_submissao: 'SOLICITACAO',
                        titulo: 'Solicitação de Cadastro - Bairro Centro',
                        descricao: 'Demanda para a Equipe de Educação Ambiental realizar cadastros de moradores no Centro.',
                        prioridade: 'alta'
                    }
                }),
                status: 'pending'
            },
            {
                tipo_form: 'activity_request',
                user_id: 'ope-id',
                dados: JSON.stringify({
                    form_data: {
                        tipo_submissao: 'SOLICITACAO',
                        titulo: 'Vistoria em Ponto de Descarte Irregular',
                        descricao: 'Solicito vistoria na Rua das Flores, 123. Moradores reportando acúmulo de entulho.',
                        prioridade: 'media'
                    }
                }),
                status: 'submitted'
            }
        ];
        
        const suiteStmt = db.prepare("INSERT INTO suite (user_id, dados, tipo_form, status) VALUES (?, ?, ?, ?)");
        solicitations.forEach(s => suiteStmt.run([s.user_id, s.dados, s.tipo_form, s.status]));
        suiteStmt.finalize();
        
        console.log('✅ Database initialized and seeded!');
    });
    
    db.close();
}

run().catch(console.error);
