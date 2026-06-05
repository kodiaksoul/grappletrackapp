import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Explicit code block safety check logging a descriptive warning if keys are missing or set to placeholders
if (
  !supabaseUrl ||
  !supabaseAnonKey ||
  supabaseUrl === 'your-supabase-url-here' ||
  supabaseAnonKey === 'your-supabase-anon-key-here'
) {
  console.warn(
    '⚠️ [GrappleTracker] Warning: Supabase client is not fully configured. ' +
    'Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
    'are set correctly in your .env.local file.'
  );
}

// Initialize and export a single, reusable browser client.
// Fallback values are provided to prevent the client instantiation from throwing an immediate 
// runtime crash on import if environment variables are not yet configured.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      lock: async (_name, _acquireTimeout, fn) => fn(),
    }
  }
);
