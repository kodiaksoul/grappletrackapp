const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\kodia\\.gemini\\antigravity\\brain';

function searchTranscripts(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchTranscripts(fullPath);
    } else if (item === 'transcript.jsonl') {
      console.log(`Searching transcript: ${fullPath}`);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('vaoquonpnhbnnubrncpl') || line.includes('SUPABASE_SERVICE_ROLE_KEY')) {
          // Print matching line (limit length so it doesn't blow up logs)
          console.log(`Match at line ${index + 1}: ${line.substring(0, 300)}...`);
        }
      });
    }
  }
}

try {
  searchTranscripts(brainDir);
} catch (err) {
  console.error(err);
}
