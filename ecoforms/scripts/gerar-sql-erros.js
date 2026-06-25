const fs = require('fs');
const path = require('path');

const errosFile = path.join(__dirname, '..', 'download', 'formSubmissions_ERROS_2026-05-28T12-33-52-630Z.json');
const outputFile = path.join(__dirname, '..', 'download', 'inserir_erros_supabase.sql');

const data = JSON.parse(fs.readFileSync(errosFile, 'utf-8'));

console.log('Registros com erro:', data.length);

let sql = `-- Inserir ${data.length} registros pendentes na tabela suite\n`;
sql += `-- Gerado em ${new Date().toISOString()}\n\n`;
sql += `BEGIN;\n\n`;

for (let i = 0; i < data.length; i++) {
  const item = data[i];
  const r = item.value || item;
  
  const dados = {
    data: r.data || null,
    hora: r.hora || null,
    user: r.user || r.usuario || r.nome_usuario || null,
    placa: (r.placa || '').toUpperCase().trim(),
    bairro: r.bairro || null,
    device: r.device || null,
    equipe: r.equipe || null,
    formId: r.formId || r.tipo_form || 'ecopontoForm',
    perfil: r.perfil || 'operador',
    usuario: r.usuario || r.user || null,
    ecoponto: r.ecoponto || r.nome_ecoponto || null,
    inspetor: r.inspetor || r.usuario || null,
    operador: r.operador || r.usuario || null,
    residuos: r.residuos || '[]',
    timestamp: r.timestamp || r.createdAt || new Date().toISOString(),
    tipo_form: r.tipo_form || 'ecopontoForm',
    formTitulo: r.formTitulo || 'Atendimentos em Ecoponto',
    usuario_id: r.usuario_id || '7fc37a72-b5c9-44d0-9fda-3ac032cc8544',
    caixas_list: r.caixas_list ? JSON.stringify(r.caixas_list) : '',
    responsavel: r.responsavel || r.usuario || null,
    nome_usuario: r.nome_usuario || r.usuario || null,
    usuario_nome: r.usuario_nome || r.usuario || null,
    _storagePaths: r._storagePaths || {},
    nome_ecoponto: r.nome_ecoponto || r.ecoponto || null
  };
  
  const dadosJson = JSON.stringify(dados);
  const userId = r.userId || '00000000-0000-0000-0000-000000000000';
  const tipoForm = r.tipo_form || 'ecopontoForm';
  
  const insert = `INSERT INTO suite (id, user_id, dados, tipo_form, status) VALUES (
  ${r.id},
  '${userId}',
  '${dadosJson.replace(/'/g, "''")}',
  '${tipoForm}',
  'submitted'
);`;
  
  sql += insert + '\n';
}

sql += `\nCOMMIT;\n`;

fs.writeFileSync(outputFile, sql, 'utf-8');
console.log('Arquivo SQL gerado:', outputFile);
console.log('Total de INSERTs:', data.length);
