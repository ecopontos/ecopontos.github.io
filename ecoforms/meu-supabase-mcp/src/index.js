// Exemplo mínimo de uso do Supabase Storage em Node.js
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_ANON_KEY em .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  try {
    // Consulta de exemplo ao Storage (shared/users.json)
    const { data: fileData, error } = await supabase.storage
      .from('sync-bucket')
      .download('shared/users.json');
    
    if (error) {
      console.error('Erro do Supabase Storage:', error);
      return;
    }

    const text = await fileData.text();
    const snapshot = JSON.parse(text);
    const users = snapshot.data || snapshot.usuarios || snapshot;
    
    console.log('users (máx 10):', Array.isArray(users) ? users.slice(0, 10) : users);
  } catch (err) {
    console.error('Erro:', err);
  }
})();
