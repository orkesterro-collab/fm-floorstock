import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const found = await Promise.all(entries.map(async item => {
    const full = path.join(directory, item.name);
    return item.isDirectory() ? files(full) : [full];
  }));
  return found.flat().sort();
}

const hash = createHash('sha256');
for (const file of (await files('dist')).filter(file => file !== 'dist/version.json')) {
  hash.update(file);
  hash.update(await readFile(file));
}
const release = { app: 'fm-floorstock', version: '1.0.0', build: hash.digest('hex'), mode: 'demo', layout: 'mobile' };
await writeFile('dist/version.json', JSON.stringify(release, null, 2) + '\n');
console.log('Mobile demo build:', release.build.slice(0, 12));
