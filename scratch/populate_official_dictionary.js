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
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 2. Parse positions.csv
const csvPath = path.join(__dirname, '../positions.csv');
const csvData = fs.readFileSync(csvPath, 'utf-8');
const csvLines = csvData.split('\n');

const officialPositions = [];
for (let i = 1; i < csvLines.length; i++) {
  const line = csvLines[i].trim();
  if (!line) continue;

  const firstComma = line.indexOf(',');
  if (firstComma === -1) continue;

  const name = line.substring(0, firstComma).trim();
  let definition = line.substring(firstComma + 1).trim();

  // Strip enclosing quotes
  if (definition.startsWith('"') && definition.endsWith('"')) {
    definition = definition.substring(1, definition.length - 1);
  }
  definition = definition.replace(/""/g, '"');

  officialPositions.push({
    term_name: name,
    term_type: 'Position',
    description: definition,
    video_url: ''
  });
}

console.log(`Parsed ${officialPositions.length} positions from CSV.`);

// 3. Define the 7 official techniques
const officialTechniques = [
  {
    term_name: 'Omoplata',
    term_type: 'Technique',
    description: "A highly effective shoulder lock utilizing the legs to trap and leverage the opponent's arm.",
    video_url: ''
  },
  {
    term_name: 'Kimura',
    term_type: 'Technique',
    description: 'A classic double wrist lock submission targeting the shoulder rotation joint.',
    video_url: ''
  },
  {
    term_name: 'Knee Slide Pass',
    term_type: 'Technique',
    description: "A fundamental pass slicing the knee across the opponent's thigh to clear their guard structure.",
    video_url: ''
  },
  {
    term_name: 'Bow and Arrow Choke',
    term_type: 'Technique',
    description: 'A high-percentage collar choke from back control gripping the collar and leg to pivot.',
    video_url: ''
  },
  {
    term_name: 'Ezekiel Choke',
    term_type: 'Technique',
    description: 'A quick choke executed by wrapping one arm behind the neck and choking with the opposite sleeve hand.',
    video_url: ''
  },
  {
    term_name: 'Berimbolo',
    term_type: 'Technique',
    description: "A modern, rolling sweep to transition directly from De La Riva Guard to the opponent's back.",
    video_url: ''
  },
  {
    term_name: 'Baratoplata',
    term_type: 'Technique',
    description: 'A deceptive armlock setup trapping the opponent\'s wrist under the armpit, rolling to isolate the shoulder.',
    video_url: ''
  }
];

const allTerms = [...officialPositions, ...officialTechniques];

async function run() {
  console.log(`Starting insertion of ${allTerms.length} terms into official_dictionary...`);
  
  // Upsert terms to handle restarts/duplicates cleanly
  const { data, error } = await supabase
    .from('official_dictionary')
    .upsert(allTerms, { onConflict: 'term_name' });

  if (error) {
    console.error('Error inserting terms:', error);
    process.exit(1);
  }

  console.log('Successfully populated official_dictionary table!');
  process.exit(0);
}

run();
