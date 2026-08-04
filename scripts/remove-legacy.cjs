const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'AppCore.tsx');
const lines = fs.readFileSync(filePath, 'utf8').split('\n');
const originalCount = lines.length;
console.log(`Original: ${originalCount} lines\n`);

// 1. Remove whatsapp-tracking-legacy block (lines 7948-8335)
// 2. Remove team-chat-legacy block (lines 8365-8491)
// Process from last to first to maintain line numbers

const removals = [
  { name: 'team-chat-legacy', startLine: 8365, endLine: 8491 },
  { name: 'whatsapp-tracking-legacy', startLine: 7948, endLine: 8335 },
].sort((a, b) => b.startLine - a.startLine);

for (const removal of removals) {
  const startIdx = removal.startLine - 1;
  const endIdx = removal.endLine - 1;
  
  // Verify
  const firstLine = lines[startIdx];
  const lastLine = lines[endIdx];
  
  if (!firstLine.includes(removal.name)) {
    console.log(`WARNING: ${removal.name} start mismatch at line ${removal.startLine}: "${firstLine.trim().substring(0, 60)}"`);
    continue;
  }
  
  const removedCount = endIdx - startIdx + 1;
  lines.splice(startIdx, removedCount);
  console.log(`${removal.name}: removed lines ${removal.startLine}-${removal.endLine} (${removedCount} lines)`);
}

const newCount = lines.length;
console.log(`\nResult: ${originalCount} -> ${newCount} lines (removed ${originalCount - newCount})`);

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('File written successfully');
