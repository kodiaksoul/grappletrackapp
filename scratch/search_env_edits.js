const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\kodia\\.gemini\\antigravity\\brain';

function findEnvLocalEdits(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      findEnvLocalEdits(fullPath);
    } else if (item === 'transcript.jsonl') {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('.env.local') && (line.includes('replace_file_content') || line.includes('write_to_file') || line.includes('run_command'))) {
          // Parse JSON if possible to print human-readable date and index
          try {
            const obj = JSON.parse(line);
            console.log(`[${obj.created_at}] Step ${obj.step_index} in ${path.basename(path.dirname(path.dirname(fullPath)))}: ${obj.type} status: ${obj.status}`);
            if (obj.tool_calls) {
              console.log(JSON.stringify(obj.tool_calls, null, 2));
            }
          } catch (e) {
            console.log(`Match: ${line.substring(0, 200)}...`);
          }
        }
      });
    }
  }
}

try {
  findEnvLocalEdits(brainDir);
} catch (err) {
  console.error(err);
}
