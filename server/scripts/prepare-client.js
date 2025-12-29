// server/scripts/prepare-client.js
// Copies ../client/dist into ../server/public (clean copy)
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../../client/dist');
const dest = path.resolve(__dirname, '../public');

function rimraf(p) {
  if (!fs.existsSync(p)) return;
  for (const entry of fs.readdirSync(p)) {
    const cur = path.join(p, entry);
    const stat = fs.lstatSync(cur);
    if (stat.isDirectory()) rimraf(cur);
    else fs.unlinkSync(cur);
  }
  fs.rmdirSync(p);
}

function copyDir(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from)) {
    const s = path.join(from, entry);
    const d = path.join(to, entry);
    const stat = fs.statSync(s);
    if (stat.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(src)) {
  console.error('Client dist not found at', src);
  process.exit(1);
}
if (fs.existsSync(dest)) rimraf(dest);
fs.mkdirSync(dest, { recursive: true });
copyDir(src, dest);
console.log('Copied client dist to', dest);