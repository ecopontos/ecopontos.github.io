import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables')
}

const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    const response = await fetch(input, {
      ...init,
      // Add duplex: 'half' for Node 20+ runtime compatibility if body is readable stream
      // @ts-expect-error -- duplex not in standard RequestInit but required for Node 20+ streams
      duplex: init?.body ? 'half' : undefined,
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        const clone = response.clone();
        const text = await clone.text();
        const preview = text.substring(0, 200).replace(/\s+/g, ' '); // Clean up newlines for cleaner error message
        console.error('⚠️ Supabase HTML Error Response:', preview);

        // Throw a clear error that the app can display
        throw new Error(`Supabase Error: Server returned HTML instead of JSON. Project may be paused or URL invalid. Body: ${preview}`);
      }
    }

    return response;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn('⚠️ Supabase Request Aborted:', err.message);
    }
    throw err;
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: customFetch
  }
})

export function getSupabaseClient() {
  return supabase;
}
