
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env vars if dotenv is available, otherwise assume they are set
try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) {
    // ignore
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.');
    console.error('Usage: node scripts/export_registry_to_sql.js');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportData() {
    console.log('Fetching registro_dados...');

    // Fetch all rows (using primitive pagination if needed, but Supabase JS usually caps at 1000)
    // We expect < 1000 for now. If more, implement loop.
    const { data, error } = await supabase
        .from('registro_dados')
        .select('id, tipo, chave, conteudo, versao, criado_em, atualizado_em')
        .order('id');

    if (error) {
        console.error('Error fetching data:', error);
        process.exit(1);
    }

    console.log(`Found ${data.length} rows.`);

    const filePath = path.join(__dirname, '../../docs/migrations/registro_dados_rows.sql');

    const header = `INSERT INTO "public"."registro_dados" ("id", "tipo", "chave", "conteudo", "versao", "criado_em", "atualizado_em") VALUES\n`;

    const rows = data.map((row, index) => {
        const isLast = index === data.length - 1;

        // Format values
        const id = `'${row.id}'`;
        const tipo = `'${row.tipo}'`;
        const chave = row.chave ? `'${row.chave}'` : 'NULL';
        const versao = row.versao;
        const criado_em = row.criado_em ? `'${row.criado_em}'` : 'NULL';
        const atualizado_em = row.atualizado_em ? `'${row.atualizado_em}'` : 'NULL';

        // JSON content: stringify and escape single quotes
        let jsonStr = JSON.stringify(row.conteudo);
        jsonStr = jsonStr.replace(/'/g, "''"); // Escape single quotes for SQL
        const conteudo = `'${jsonStr}'`;

        return `(${id}, ${tipo}, ${chave}, ${conteudo}, ${versao}, ${criado_em}, ${atualizado_em})${isLast ? ';' : ','}`;
    });

    const content = header + rows.join('\n');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Exported to ${filePath}`);
}

exportData();
