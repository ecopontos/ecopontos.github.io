import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'styles', 'fields');
const targetDir = path.join(rootDir, 'www', 'css', 'fields');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function toPascalCaseCss(fileName) {
  const baseName = fileName.replace(/\.css$/i, '');
  const parts = baseName.split(/[-_]/g).filter(Boolean);
  const pascal = parts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  return `${pascal}.css`;
}

function copyFieldCss() {
  if (!fs.existsSync(sourceDir)) {
    console.warn(`⚠️  Diretório de origem não encontrado: ${sourceDir}`);
    return;
  }

  ensureDir(targetDir);

  const files = fs.readdirSync(sourceDir).filter(file => file.endsWith('.css'));

  if (files.length === 0) {
    console.warn('⚠️  Nenhum arquivo CSS encontrado em styles/fields.');
    return;
  }

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const targetFileName = toPascalCaseCss(file);
    const targetPath = path.join(targetDir, targetFileName);

    fs.copyFileSync(sourcePath, targetPath);
    console.log(`✓ Copiado ${file} → ${path.relative(rootDir, targetPath)}`);
  }
}

try {
  copyFieldCss();
  console.log('✅ CSS de campos sincronizado com sucesso.');
} catch (error) {
  console.error('❌ Falha ao sincronizar CSS de campos:', error);
  process.exitCode = 1;
}
