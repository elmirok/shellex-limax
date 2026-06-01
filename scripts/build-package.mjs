import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(rootDir, relativePath), 'utf8'));
}

const manifest = await readJson('manifest.json');

if (!manifest.entry || typeof manifest.entry !== 'string') {
  throw new Error('manifest.json must define a string entry file.');
}

const packageFiles = [manifest.entry];
const files = {};

for (const filePath of packageFiles) {
  files[filePath] = await readFile(join(rootDir, filePath), 'utf8');
}

const packageData = {
  manifest,
  files
};

await writeFile(
  join(rootDir, 'package.sapp.json'),
  `${JSON.stringify(packageData, null, 2)}\n`
);

console.log(`Built package.sapp.json with ${packageFiles.length} file(s).`);
