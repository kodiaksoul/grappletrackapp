const fs = require('fs');
const path = require('path');

// 1. Parse positions.csv
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
    description: definition
  });
}

// 2. Parse techniques.csv
const techniquesPath = path.join(__dirname, '../techniques.csv');
const techniquesData = fs.readFileSync(techniquesPath, 'utf-8');
const techniquesLines = techniquesData.split('\n');

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
    description: definition
  });
}

// 3. Add missing official techniques (Berimbolo, Baratoplata)
const missing = [
  {
    term_name: 'Berimbolo',
    term_type: 'Technique',
    description: "A modern, rolling sweep to transition directly from De La Riva Guard to the opponent's back."
  },
  {
    term_name: 'Baratoplata',
    term_type: 'Technique',
    description: 'A deceptive armlock setup trapping the opponent\'s wrist under the armpit, rolling to isolate the shoulder.'
  }
];

missing.forEach(item => {
  const exists = allTerms.some(t => t.term_name.toLowerCase() === item.term_name.toLowerCase());
  if (!exists) {
    allTerms.push(item);
  }
});

// Helper to escape SQL string literals
function escapeSqlString(str) {
  return str.replace(/'/g, "''");
}

// 4. Generate SQL Statements
let sql = 'INSERT INTO public.official_dictionary (term_name, term_type, description, video_url) VALUES \n';
const values = allTerms.map(t => {
  return `('${escapeSqlString(t.term_name)}', '${t.term_type}', '${escapeSqlString(t.description)}', '')`;
});

sql += values.join(',\n') + '\nON CONFLICT (term_name) DO UPDATE SET \n' +
  '  term_type = EXCLUDED.term_type,\n' +
  '  description = EXCLUDED.description,\n' +
  '  video_url = EXCLUDED.video_url;';

fs.writeFileSync(path.join(__dirname, 'insert_all_terms.sql'), sql, 'utf-8');
console.log(`Generated SQL script insert_all_terms.sql with ${allTerms.length} terms.`);
