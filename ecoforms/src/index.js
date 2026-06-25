const { getSupabaseClient } = require('./supabase-client');

async function queryProfiles() {
  try {
    const supabase = await getSupabaseClient();
    
    // Buscar do Storage em vez de tabela direta
    const { data: fileData, error } = await supabase.storage
      .from('sync-bucket')
      .download('shared/users.json');

    if (error) {
      console.error('Error fetching users from Storage:', error);
      return null;
    }

    const text = await fileData.text();
    const snapshot = JSON.parse(text);
    const data = snapshot.data || snapshot.usuarios || snapshot;
    
    return Array.isArray(data) ? data : [data];
  } catch (e) {
    console.error('Unexpected error while querying Supabase Storage:', e);
    return null;
  }
}

async function start() {
  try {
    const profiles = await queryProfiles();
    console.log('Profiles data:', profiles);
  } catch (e) {
    console.error('Application error:', e);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = { queryProfiles };
