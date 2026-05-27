const fs = require('fs');
const path = require('path');

const chunkPath = path.join('.next', 'static', 'chunks', '493-38dd501cd76b5ad2.js');
if (fs.existsSync(chunkPath)) {
  const content = fs.readFileSync(chunkPath, 'utf8');
  
  // Find all indices of useMemo
  let index = content.indexOf('useMemo');
  while (index !== -1) {
    console.log(`\n--- useMemo found at index ${index} ---`);
    console.log(content.substring(Math.max(0, index - 200), Math.min(content.length, index + 200)));
    index = content.indexOf('useMemo', index + 1);
  }
} else {
  console.log('Chunk not found');
}
