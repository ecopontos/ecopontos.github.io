const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UI_ROOTS = ['app', 'components', 'src/interface'].map((dir) => path.join(ROOT, dir));
const TABLE_SCAN_ROOTS = ['scripts', 'src', 'src-tauri', 'migrations'].map((dir) => path.join(ROOT, dir));
const REPORT_PATH = path.join(ROOT, 'docs', 'AUDITORIA_REORGANIZACAO_BACKEND_LOCAL_INTEGRACOES.md');
const SELF_PATH = path.resolve(__filename);

const INFRA_IMPORT_PATTERNS = [
    /from ['"]@\/src\/infrastructure\/([^'"]+)['"]/g,
    /from ['"][^'"]*infrastructure\/([^'"]+)['"]/g,
];

const TABLE_PATTERNS = [
    'tbl_service_types',
    'tbl_service_slots',
    'tbl_agendamentos',
    'tbl_agendamento_notificacoes',
    'tbl_configuracoes_sistema',
    'tbl_email_config',
    'geo_layers',
    'sync_salt_history',
    'suite_fts',
    'app_config',
];

const INTEGRATION_RULES = [
    { label: 'crud-local', match: /container|sqlite|queries\/|AccessFilterBuilder|SectorQueryUtils/ },
    { label: 'integracao-externa', match: /supabase|crm-datasources|viacep|nominatim/i },
    { label: 'hub-lan', match: /lan|pocketbase/i },
    { label: 'legado\/compatibilidade', match: /legacy|postgres|pg_|app_config|tbl_/i },
];

const TEMP_EXCEPTIONS = [
    {
        alvo: 'src/interface/hooks/utils/useContainer.ts',
        motivo: 'ponte temporaria de composicao para DI enquanto hooks de dominio substituem getContainer direto',
        prazo: '2026-07-31',
    },
    {
        alvo: 'src/interface/hooks/utils/useSupabaseClient.ts',
        motivo: 'escape hatch legado; deve sumir conforme fluxos de storage/admin migrem para hooks especificos',
        prazo: '2026-07-15',
    },
];

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...walk(fullPath));
            continue;
        }
        files.push(fullPath);
    }
    return files;
}

function readText(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function rel(filePath) {
    return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function collectInfraImports() {
    const matches = [];

    for (const root of UI_ROOTS) {
        for (const filePath of walk(root)) {
            if (path.resolve(filePath) === SELF_PATH) continue;
            if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) continue;
            const source = readText(filePath);
            const lines = source.split(/\r?\n/);

            lines.forEach((line, index) => {
                INFRA_IMPORT_PATTERNS.forEach((pattern) => {
                    pattern.lastIndex = 0;
                    const match = pattern.exec(line);
                    if (!match) return;

                    const target = match[1];
                    const classe = classify(`${rel(filePath)} ${target}`);
                    matches.push({
                        arquivo: rel(filePath),
                        linha: index + 1,
                        alvo: target,
                        classe,
                    });
                });
            });
        }
    }

    return matches.sort((a, b) => a.arquivo.localeCompare(b.arquivo) || a.linha - b.linha);
}

function collectTables() {
    const matches = [];

    for (const root of TABLE_SCAN_ROOTS) {
        for (const filePath of walk(root)) {
            if (path.resolve(filePath) === SELF_PATH) continue;
            if (!/\.(ts|tsx|js|jsx|rs|sql|md)$/.test(filePath)) continue;
            const source = readText(filePath);
            const lines = source.split(/\r?\n/);

            lines.forEach((line, index) => {
                TABLE_PATTERNS.forEach((tableName) => {
                    if (!line.includes(tableName)) return;
                    matches.push({
                        tabela: tableName,
                        arquivo: rel(filePath),
                        linha: index + 1,
                        classe: classify(tableName),
                    });
                });
            });
        }
    }

    return matches.sort((a, b) => a.tabela.localeCompare(b.tabela) || a.arquivo.localeCompare(b.arquivo) || a.linha - b.linha);
}

function classify(value) {
    const rule = INTEGRATION_RULES.find((item) => item.match.test(value));
    return rule ? rule.label : 'crud-local';
}

function countByClass(items) {
    return items.reduce((acc, item) => {
        acc[item.classe] = (acc[item.classe] ?? 0) + 1;
        return acc;
    }, {});
}

function formatCounts(counts) {
    return ['crud-local', 'integracao-externa', 'hub-lan', 'legado/compatibilidade']
        .map((label) => `- \`${label}\`: ${counts[label] ?? 0}`)
        .join('\n');
}

function renderSectionRows(items, mapper) {
    if (!items.length) {
        return '_Nenhum achado._';
    }

    return items.map(mapper).join('\n');
}

function buildReport(infraImports, tables) {
    const now = new Date().toISOString();
    const importCounts = countByClass(infraImports);
    const tableCounts = countByClass(tables);

    return `# Auditoria executavel de fronteiras e SQL lusofono

**Gerado em:** ${now}
**Escopo:** Fase A do \`PLANO_REORGANIZACAO_BACKEND_LOCAL_INTEGRACOES.md\`

## Resumo

### Imports de infraestrutura na UI

Total: **${infraImports.length}**

${formatCounts(importCounts)}

### Referencias a nomes de tabela fora da convencao lusofona

Total: **${tables.length}**

${formatCounts(tableCounts)}

## Imports de infraestrutura na UI

${renderSectionRows(infraImports, (item) => `- \`${item.classe}\` [${item.arquivo}:${item.linha}] -> \`${item.alvo}\``)}

## Referencias a tabelas nao canonicas

${renderSectionRows(tables, (item) => `- \`${item.classe}\` [${item.arquivo}:${item.linha}] -> \`${item.tabela}\``)}

## Excecoes temporarias aceitas

${TEMP_EXCEPTIONS.map((item) => `- \`${item.alvo}\` — ${item.motivo}. Prazo: **${item.prazo}**.`).join('\n')}

## Leitura operacional

- \`crud-local\`: chamadas que ainda atravessam container/query packs do backend local embutido.
- \`integracao-externa\`: fluxos dependentes de Supabase ou outra integracao HTTP/SDK.
- \`hub-lan\`: adaptadores de LAN/PocketBase e distribuicao entre maquinas.
- \`legado/compatibilidade\`: nomes e acessos mantidos por compatibilidade ou transicao de schema.
`;
}

const infraImports = collectInfraImports();
const tables = collectTables();
const report = buildReport(infraImports, tables);

fs.writeFileSync(REPORT_PATH, report);
process.stdout.write(`${report}\n`);
