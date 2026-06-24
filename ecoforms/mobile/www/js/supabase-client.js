/*
 * Frontend Supabase client factory
 * Exposes two helpers on window:
 * - getSupabaseClientSync(url,key): tries to return a singleton client synchronously (or null)
 * - getSupabaseClient(url,key,timeout): returns a Promise that resolves when client is available
 *
 * This centralizes client creation to avoid multiple GoTrueClient instances and keeps
 * backward compatibility with pages that load @supabase/supabase-js via CDN (window.supabase).
 */
(function () {
  'use strict';

  function createClientIfPossible(url, key) {
    try {
      if (typeof window === 'undefined') return null;
      // If a global already exists, return it
      if (window.globalSupabaseClient) return window.globalSupabaseClient;

      // If the CDN script exposed `supabase` global, use it
      if (typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function') {
        window.globalSupabaseClient = window.supabase.createClient(url, key);
        return window.globalSupabaseClient;
      }

      // Some bundlers might expose a createClient function directly (rare in browser), try defensively
      if (typeof window.createClient === 'function') {
        window.globalSupabaseClient = window.createClient(url, key);
        return window.globalSupabaseClient;
      }

      return null;
    } catch (e) {
      console.warn('createClientIfPossible failed', e);
      return null;
    }
  }

  window.getSupabaseClientSync = function (url, key) {
    return createClientIfPossible(url, key);
  };

  window.getSupabaseClient = function (url, key, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const client = createClientIfPossible(url, key);
      if (client) return resolve(client);

      // Poll for the supabase global to be available (useful if script loads slightly later)
      const intervalMs = 100;
      let waited = 0;
      const iv = setInterval(() => {
        const c = createClientIfPossible(url, key);
        if (c) {
          clearInterval(iv);
          return resolve(c);
        }
        waited += intervalMs;
        if (waited >= timeout) {
          clearInterval(iv);
          return reject(new Error('Supabase client not available within timeout'));
        }
      }, intervalMs);
    });
  };

  // Helpful alias for backwards compatibility
  if (!window.getGlobalSupabaseClient) window.getGlobalSupabaseClient = window.getSupabaseClient;

})();
