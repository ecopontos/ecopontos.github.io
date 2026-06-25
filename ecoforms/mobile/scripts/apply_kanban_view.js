import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = '\\\\192.168.12.1\\smmads\\Dep. Técnico\\Tecnicos_e_Administrativos\\TECNICOS_e_ADMINISTRATIVO\\Administrativo\\Bases de Dados\\banco\\ecoforms.sqlite';

async function run() {
    console.log(`Connecting to database at ${dbPath}`);
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const sql = `
    DROP VIEW IF EXISTS view_tarefas_unificadas;

    CREATE VIEW view_tarefas_unificadas AS
    SELECT 
        t.id as tarefa_id,
        t.titulo,
        t.descricao,
        t.status,
        t.prioridade,
        t.prazo,
        t.ordem,
        t.arquivado AS arquivado,
        t.tags,
        t.created_at,
        t.updated_at,

        t.projeto_id,
        p.nome as projeto_nome,
        p.cor as projeto_cor,

        t.atribuido_para,
        u_atribuido.username as atribuido_username,
        t.criado_por,
        u_criador.username as criador_username,

        t.form_registry_id,
        fr.titulo as form_nome,
        fr.tipo_form,
        t.tbl_suite_id,
        ts.status as form_status,
        ts.dados as form_dados,

        CASE 
            WHEN t.prazo IS NOT NULL AND t.prazo < datetime('now') AND t.status != 'concluido' THEN 1
            ELSE 0
        END as atrasado,

        CASE 
            WHEN t.prazo IS NOT NULL AND t.prazo < datetime('now', '+3 days') AND t.status != 'concluido' THEN 1
            ELSE 0
        END as proximo_prazo,

        (SELECT COUNT(*) FROM tarefas_comentarios tc WHERE tc.tarefa_id = t.id) as num_comentarios,
        (SELECT COUNT(*) FROM tarefas_anexos ta WHERE ta.tarefa_id = t.id) as num_anexos,

        CASE 
            WHEN t.tbl_suite_id IS NOT NULL THEN 'formulario'
            ELSE 'kanban'
        END as origem
    FROM tarefas t
    LEFT JOIN projetos p ON p.id = t.projeto_id
    LEFT JOIN usuarios u_atribuido ON u_atribuido.id = t.atribuido_para
    LEFT JOIN usuarios u_criador ON u_criador.id = t.criado_por
    LEFT JOIN form_registry fr ON fr.form_id = t.form_registry_id
    LEFT JOIN suite ts ON ts.id = t.tbl_suite_id;
    `;

    try {
        await db.exec(sql);
        console.log('Successfully created view_tarefas_unificadas');
    } catch (err) {
        console.error('Error creating view:', err);
    } finally {
        await db.close();
    }
}

run();
