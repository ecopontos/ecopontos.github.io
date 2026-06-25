import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Iniciando servidor de desenvolvimento...');
console.log('📁 Diretório atual:', __dirname);

const app = express();
// ⚠️ CORS aberto é aceitável apenas em desenvolvimento local isolado.
// Nunca use app.use(cors()) sem restrição de origem em produção.
app.use(cors());

// Basic security headers even for dev
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
});

const port = 5502;

// Helper para servir arquivos estáticos com MIME types corretos
const serveStaticWithMime = (directory) => express.static(directory, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
      res.type('application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.type('text/css');
    } else if (filePath.endsWith('.json')) {
      res.type('application/json');
    } else if (filePath.endsWith('.html')) {
      res.type('text/html');
    } else if (filePath.endsWith('.png')) {
      res.type('image/png');
    } else if (filePath.endsWith('.svg')) {
      res.type('image/svg+xml');
    } else if (filePath.endsWith('.ico')) {
      res.type('image/x-icon');
    }
  }
});

// IMPORTANTE: Servir arquivos estáticos ANTES das rotas específicas
// Isso garante que CSS, JS, JSON, etc. sejam servidos corretamente
app.use(serveStaticWithMime(path.join(__dirname, 'www')));

// Servir pasta styles da raiz (para tailwind.css se necessário)  
app.use('/styles', serveStaticWithMime(path.join(__dirname, 'styles')));

// Prioriza js/ na raiz, mas mantém www/js para compatibilidade
app.use('/js', serveStaticWithMime(path.join(__dirname, 'js')));
app.use('/js', serveStaticWithMime(path.join(__dirname, 'www', 'js')));

// Servir arquivos da pasta 'tests' para testes
app.use('/tests', serveStaticWithMime(path.join(__dirname, 'tests')));

// ROTAS ESPECÍFICAS (após arquivos estáticos)
// Rota de teste
app.get('/server-test', (req, res) => {
  console.log('🧪 Rota de teste acessada');
  res.send('Servidor funcionando!');
});

// Rota simples de teste
app.get('/test', (req, res) => {
  console.log('🧪 Rota /test acessada');
  res.send('Rota /test funcionando!');
});

app.listen(port, () => {
  console.log(`✅ Servidor de desenvolvimento rodando em http://localhost:${port}`);
  console.log(`🧪 Teste: http://localhost:${port}/server-test`);
  console.log(`📂 Servindo arquivos de: ${path.join(__dirname, 'www')}`);
});
