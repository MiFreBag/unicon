// desktop/scripts/copy-dist.js
// Copies client/dist into server/public for production serving

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

async function rimraf(dir) {
  try {
    await fsp.rm(dir, { recursive: true, force: true });
  } catch (_) {}
}

async function copyDir(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else if (entry.isFile()) {
      await fsp.copyFile(s, d);
    }
  }
}

(async () => {
  const src = path.join(__dirname, '../../client/dist');
  const dest = path.join(__dirname, '../../server/public');

  try {
    await fsp.access(src);
  } catch (e) {
    console.error('client/dist not found. Build the client first: npm --prefix client run build');
    process.exit(1);
  }

  await rimraf(dest);
  await copyDir(src, dest);
  console.log(`Copied ${src} -> ${dest}`);
})();
