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

const declaredFiles = await readJson('package.files.json');
if (!Array.isArray(declaredFiles)) {
  throw new Error('package.files.json must be an array of package file paths.');
}

const packageFiles = [...new Set([manifest.entry, ...declaredFiles])];
const files = {};

for (const filePath of packageFiles) {
  if (typeof filePath !== 'string' || !filePath || filePath.startsWith('/') || filePath.includes('..')) {
    throw new Error(`Invalid package file path: ${String(filePath)}`);
  }
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
