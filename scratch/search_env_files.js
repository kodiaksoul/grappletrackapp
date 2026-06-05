const fs = require('fs');
const path = require('path');

const rootDir = 'c:\\projects';

function findEnvLocalFiles(dir) {
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        if (item === 'node_modules' || item === '.next' || item === '.git' || item === 'out') continue;
        findEnvLocalFiles(fullPath);
      } else if (item === '.env.local' || item === '.env') {
        console.log(`Found file: ${fullPath}`);
        const content = fs.readFileSync(fullPath, 'utf-8');
        console.log('--- Content ---');
        console.log(content);
        console.log('---------------');
      }
    }
  } catch (err) {
    // Ignore read errors
  }
}

findEnvLocalFiles(rootDir);
