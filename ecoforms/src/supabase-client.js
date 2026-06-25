let createClient;

async function initSupabaseClient() {
  try {
    ({ createClient } = require('@supabase/supabase-js'));
  } catch (err) {
    const mod = await import('@supabase/supabase-js');
    createClient = mod.createClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.');
  }

  return createClient(supabaseUrl, supabaseKey);
}

let supabaseInstance = null;

async function getSupabaseClient() {
  if (!supabaseInstance) {
    try {
      require('dotenv').config({ path: '../.env' });
    } catch (e) {
      try {
        require('dotenv').config({ path: './.env' });
      } catch (e) {
        // ignore if dotenv not installed
      }
    }
    supabaseInstance = await initSupabaseClient();
  }
  return supabaseInstance;
}

module.exports = { getSupabaseClient };
