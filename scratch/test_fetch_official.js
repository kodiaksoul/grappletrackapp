const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 1. Load env vars from .env.local
const envFile = fs.readFileSync(path.join(__dirname, '../.env.local'), 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log('Fetching official_dictionary using Anon key...');
  const { data, error } = await supabase
    .from('official_dictionary')
    .select('*');

  if (error) {
    console.error('Fetch error:', error);
  } else {
    console.log(`Success! Fetched ${data.length} terms.`);
    if (data.length > 0) {
      console.log('Sample term:', data[0]);
    }
  }
  process.exit(0);
}

run();
