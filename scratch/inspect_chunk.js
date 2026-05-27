const fs = require('fs');
const path = require('path');

const chunkPath = path.join('.next', 'static', 'chunks', '493-38dd501cd76b5ad2.js');
if (fs.existsSync(chunkPath)) {
  const content = fs.readFileSync(chunkPath, 'utf8');
  console.log('Chunk length:', content.length);
  
  // Search for keywords
  const keywords = ['Navigation', 'AuthGuard', 'useSearchParams', 'usePathname', 'useRouter', 'InviteContent', 'DashboardPage', 'HistoryPage', 'ProfilePage', 'MasterAdminPage'];
  keywords.forEach(kw => {
    if (content.includes(kw)) {
      console.log(`Found keyword: "${kw}"`);
    }
  });
} else {
  console.log('Chunk not found at:', chunkPath);
}
