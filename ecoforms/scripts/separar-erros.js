const fs = require('fs');
const path = require('path');

const inputFile = path.join(__dirname, '..', 'download', 'formSubmissions.json');
const outputDir = path.join(__dirname, '..', 'download');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputFile = path.join(outputDir, `formSubmissions_ERROS_${timestamp}.json`);

// Ler arquivo original
const raw = fs.readFileSync(inputFile, 'utf-8');
const data = JSON.parse(raw);

console.log(`Total de registros no arquivo: ${data.length}`);

// Filtrar apenas registros com erro
const erros = data.filter(item => {
  const registro = item.value || item;
  return registro.syncStatus === 'error';
});

console.log(`Registros com status 'error': ${erros.length}`);

// Salvar arquivo separado
fs.writeFileSync(outputFile, JSON.stringify(erros, null, 2), 'utf-8');
console.log(`Arquivo de erros salvo em: ${outputFile}`);

// Resumo dos erros
const datasErro = {};
const idsErro = [];
for (const item of erros) {
  const r = item.value || item;
  idsErro.push(r.id);
  if (r.data) {
    datasErro[r.data] = (datasErro[r.data] || 0) + 1;
  }
}

console.log('\nDatas com erros:');
for (const [data, count] of Object.entries(datasErro).sort()) {
  console.log(`  ${data}: ${count} registros`);
}

console.log('\nIDs dos registros com erro:');
console.log(idsErro.join(', '));
