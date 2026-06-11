const fs = require('fs');
const c = fs.readFileSync('src/index.ts', 'utf8');
const search = "['active', 'joined', 'pending', 'invited'].includes(member.status)";
const replace = "['active', 'joined'].includes(member.status)";
if (c.includes(search)) {
  const r = c.replace(search, replace);
  fs.writeFileSync('src/index.ts', r);
  console.log('Replaced successfully');
} else {
  console.log('NOT FOUND - checking context...');
  const idx = c.indexOf('projectId === req.params.projectId');
  if (idx > -1) {
    console.log('Context:', c.substring(idx, idx + 150));
  } else {
    console.log('projectId marker not found either');
  }
}
