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
const positionsPath = path.join(__dirname, '../positions.csv');
const positionsData = fs.readFileSync(positionsPath, 'utf-8');
const positionsLines = positionsData.split('\n');

const allTerms = [];

for (let i = 1; i < positionsLines.length; i++) {
  const line = positionsLines[i].trim();
  if (!line) continue;

  const firstComma = line.indexOf(',');
  if (firstComma === -1) continue;

  const name = line.substring(0, firstComma).trim();
  let definition = line.substring(firstComma + 1).trim();

  if (definition.startsWith('"') && definition.endsWith('"')) {
    definition = definition.substring(1, definition.length - 1);
  }
  definition = definition.replace(/""/g, '"');

  allTerms.push({
    term_name: name,
    term_type: 'Position',
    description: definition,
    video_url: ''
  });
}

console.log(`Parsed ${allTerms.length} positions from positions.csv.`);

// 3. Parse techniques.csv
const techniquesPath = path.join(__dirname, '../techniques.csv');
const techniquesData = fs.readFileSync(techniquesPath, 'utf-8');
const techniquesLines = techniquesData.split('\n');

let techCount = 0;
for (let i = 1; i < techniquesLines.length; i++) {
  const line = techniquesLines[i].trim();
  if (!line) continue;

  const firstComma = line.indexOf(',');
  if (firstComma === -1) continue;

  const name = line.substring(0, firstComma).trim();
  let definition = line.substring(firstComma + 1).trim();

  if (definition.startsWith('"') && definition.endsWith('"')) {
    definition = definition.substring(1, definition.length - 1);
  }
  definition = definition.replace(/""/g, '"');

  allTerms.push({
    term_name: name,
    term_type: 'Technique',
    description: definition,
    video_url: ''
  });
  techCount++;
}

console.log(`Parsed ${techCount} techniques from techniques.csv.`);

// 4. Add missing official techniques (Berimbolo, Baratoplata)
const missingTechniques = [
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

missingTechniques.forEach(missing => {
  const exists = allTerms.some(t => t.term_name.toLowerCase() === missing.term_name.toLowerCase());
  if (!exists) {
    allTerms.push(missing);
    console.log(`Added missing technique: ${missing.term_name}`);
  }
});

async function run() {
  console.log(`Starting upsert of ${allTerms.length} total terms into official_dictionary...`);
  
  const { data, error } = await supabase
    .from('official_dictionary')
    .upsert(allTerms, { onConflict: 'term_name' });

  if (error) {
    console.error('Error inserting terms:', error);
    process.exit(1);
  }

  console.log('Successfully populated official_dictionary with all positions and techniques!');
  process.exit(0);
}

run();
