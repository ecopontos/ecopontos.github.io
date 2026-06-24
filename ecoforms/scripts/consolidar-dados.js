// Script para consolidar dados do Supabase com dados locais do IndexedDB
// Uso: node scripts/consolidar-dados.js <arquivo-supabase.json>

const fs = require('fs');
const path = require('path');

// Arquivos de entrada
const SUPABASE_FILE = process.argv[2]; // Passado como argumento
const LOCAL_FILE = path.join(__dirname, '..', 'download', 'formSubmissions.json');
const ERROS_FILE = path.join(__dirname, '..', 'download', 'formSubmissions_ERROS_2026-05-28T12-33-52-630Z.json');

// Diretório de saída
const OUTPUT_DIR = path.join(__dirname, '..', 'download', 'consolidado');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function log(msg) {
  console.log(`[Consolidar] ${msg}`);
}

function parseJSONFile(filePath) {
  if (!fs.existsSync(filePath)) {
    log(`Arquivo não encontrado: ${filePath}`);
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(data) ? data : [data];
  } catch (e) {
    log(`Erro ao ler ${filePath}: ${e.message}`);
    return [];
  }
}

function extractRecord(item) {
  // Normalizar estrutura - pode vir do Supabase (flat) ou do IndexedDB (value/key)
  const r = item.value || item.dados || item;
  return r;
}

function generateIdUnico(registro) {
  // Formato: ID + DataAAAAMMDD + HoraHHMM + Placa
  const id = String(registro.id || '');
  let dataNum = '';
  let horaNum = '';
  const placa = (registro.placa || '').toUpperCase().trim();
  
  if (registro.data && /^\d{4}-\d{2}-\d{2}$/.test(registro.data)) {
    dataNum = registro.data.replace(/-/g, '');
  } else if (registro.data && /^\d{2}\/\d{2}\/\d{4}$/.test(registro.data)) {
    const [d, m, y] = registro.data.split('/');
    dataNum = `${y}${m}${d}`;
  }
  
  if (registro.hora && /^\d{2}:\d{2}/.test(registro.hora)) {
    horaNum = registro.hora.substring(0, 5).replace(':', '');
  }
  
  return `${id}${dataNum}${horaNum}${placa}`;
}

function recordToCSVRow(registro) {
  const r = extractRecord(registro);
  
  const ecoponto = r.ecoponto || r.nome_ecoponto || '';
  const placa = (r.placa || '').toUpperCase().trim();
  
  // Data
  let dataStr = r.data || '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
    const [y, m, d] = dataStr.split('-');
    dataStr = `${d}/${m}/${y}`;
  }
  
  // Hora
  let horaStr = r.hora || '';
  if (/^\d{2}:\d{2}$/.test(horaStr)) {
    horaStr = horaStr + ':00';
  }
  
  // Bairro
  let bairro = r.bairro || '';
  bairro = bairro.charAt(0).toUpperCase() + bairro.slice(1);
  
  // Resíduos
  let residuos = r.residuos || '';
  try {
    const parsed = JSON.parse(residuos);
    if (Array.isArray(parsed)) {
      residuos = parsed.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(',');
    }
  } catch (e) {
    residuos = residuos.split(',').map(s => {
      s = s.trim();
      return s.charAt(0).toUpperCase() + s.slice(1);
    }).join(',');
  }
  
  // Hora Registro
  let horaRegistro = '';
  const ts = r.createdAt || r.timestamp || '';
  if (ts) {
    const d = new Date(ts);
    if (!isNaN(d.getTime())) {
      horaRegistro = d.toLocaleTimeString('pt-BR', { hour12: false });
    }
  }
  
  // idUnico
  const idUnico = generateIdUnico(r);
  
  return [
    ecoponto,
    placa,
    dataStr,
    horaStr,
    bairro,
    residuos,
    horaRegistro,
    idUnico
  ];
}

// ============ MAIN ============

async function main() {
  log('Iniciando consolidação...');
  log('');
  
  // 1. Carregar dados locais (do celular)
  const localData = parseJSONFile(LOCAL_FILE);
  log(`Dados locais (IndexedDB): ${localData.length} registros`);
  
  // 2. Carregar dados do Supabase
  let supabaseData = [];
  if (SUPABASE_FILE) {
    supabaseData = parseJSONFile(SUPABASE_FILE);
    log(`Dados do Supabase: ${supabaseData.length} registros`);
  } else {
    log('Arquivo do Supabase não informado. Use: node scripts/consolidar-dados.js <arquivo.json>');
    log('Processando apenas dados locais...');
  }
  
  // 3. Carregar registros com erro (já verificados)
  const errosData = parseJSONFile(ERROS_FILE);
  log(`Registros com erro (já em SQL): ${errosData.length}`);
  
  log('');
  
  // 4. Consolidar e remover duplicatas
  const allRecords = [];
  const seenIds = new Set();
  const seenIdUnico = new Set();
  
  // Adicionar Supabase primeiro (fonte de verdade)
  for (const item of supabaseData) {
    const r = extractRecord(item);
    if (r.id && seenIds.has(r.id)) continue;
    if (r.id) seenIds.add(r.id);
    allRecords.push(r);
  }
  
  // Adicionar locais que não estão no Supabase
  let duplicatas = 0;
  let novos = 0;
  for (const item of localData) {
    const r = extractRecord(item);
    if (r.id && seenIds.has(r.id)) {
      duplicatas++;
      continue;
    }
    if (r.id) seenIds.add(r.id);
    novos++;
    allRecords.push(r);
  }
  
  log(`Duplicatas encontradas: ${duplicatas}`);
  log(`Registros novos (apenas local): ${novos}`);
  log(`Total consolidado: ${allRecords.length}`);
  log('');
  
  // 5. Gerar JSON consolidado
  const jsonOutput = path.join(OUTPUT_DIR, 'dados_consolidados.json');
  fs.writeFileSync(jsonOutput, JSON.stringify(allRecords, null, 2), 'utf-8');
  log(`JSON consolidado: ${jsonOutput}`);
  
  // 6. Gerar CSV
  const header = ['Ecoponto','Placa','Data','Hora','Bairro','Resíduos','Hora Registro','idUnico'];
  let csv = header.join(';') + '\n';
  
  for (const r of allRecords) {
    const row = recordToCSVRow(r);
    csv += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';') + '\n';
  }
  
  const csvOutput = path.join(OUTPUT_DIR, 'atendimentos_consolidados.csv');
  fs.writeFileSync(csvOutput, csv, 'utf-8');
  log(`CSV consolidado: ${csvOutput}`);
  
  // 7. Estatísticas
  const stats = {
    total: allRecords.length,
    porStatus: {},
    porEcoponto: {},
    porData: {},
    porBairro: {},
    rangeDatas: { min: null, max: null }
  };
  
  for (const r of allRecords) {
    const status = r.syncStatus || r.status || 'unknown';
    stats.porStatus[status] = (stats.porStatus[status] || 0) + 1;
    
    const ecoponto = r.ecoponto || r.nome_ecoponto || 'N/A';
    stats.porEcoponto[ecoponto] = (stats.porEcoponto[ecoponto] || 0) + 1;
    
    const data = r.data || 'N/A';
    stats.porData[data] = (stats.porData[data] || 0) + 1;
    
    const bairro = r.bairro || 'N/A';
    stats.porBairro[bairro] = (stats.porBairro[bairro] || 0) + 1;
    
    if (r.data) {
      if (!stats.rangeDatas.min || r.data < stats.rangeDatas.min) stats.rangeDatas.min = r.data;
      if (!stats.rangeDatas.max || r.data > stats.rangeDatas.max) stats.rangeDatas.max = r.data;
    }
  }
  
  const statsOutput = path.join(OUTPUT_DIR, 'estatisticas.json');
  fs.writeFileSync(statsOutput, JSON.stringify(stats, null, 2), 'utf-8');
  log(`Estatísticas: ${statsOutput}`);
  
  log('');
  log('=== RESUMO ===');
  log(`Total de registros: ${stats.total}`);
  log(`Período: ${stats.rangeDatas.min} a ${stats.rangeDatas.max}`);
  log('Por status:', JSON.stringify(stats.porStatus));
  log(`Arquivos salvos em: ${OUTPUT_DIR}`);
}

main().catch(e => {
  console.error('Erro:', e);
  process.exit(1);
});
