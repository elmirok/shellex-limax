import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const failures = [];

async function readText(relativePath) {
  return readFile(join(rootDir, relativePath), 'utf8');
}

async function readJson(relativePath) {
  try {
    return JSON.parse(await readText(relativePath));
  } catch (error) {
    throw new Error(`${relativePath} is not valid JSON: ${error.message}`);
  }
}

function check(condition, message) {
  if (condition) {
    console.log(`OK ${message}`);
    return;
  }

  failures.push(message);
  console.error(`FAIL ${message}`);
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

const manifest = await readJson('manifest.json');
const packageRaw = await readText('package.sapp.json');
const packageData = await readJson('package.sapp.json');
const entryFile = typeof manifest.entry === 'string' ? manifest.entry : '';
const entryContents = entryFile ? await readText(entryFile) : '';

check(typeof manifest.id === 'string' && manifest.id.length > 0, 'manifest id is present');
check(typeof manifest.name === 'string' && manifest.name.length > 0, 'manifest name is present');
check(typeof manifest.version === 'string' && manifest.version.length > 0, 'manifest version is present');
check(typeof manifest.entry === 'string' && manifest.entry.length > 0, 'manifest entry is present');
check(Array.isArray(manifest.permissions), 'manifest permissions is an array');
check(packageData && typeof packageData === 'object', 'package root is an object');
check(sameJson(packageData.manifest, manifest), 'package manifest matches manifest.json');
check(
  packageData.files && typeof packageData.files === 'object' && !Array.isArray(packageData.files),
  'package files map is present'
);
check(
  Boolean(entryFile && packageData.files && Object.hasOwn(packageData.files, entryFile)),
  'package embeds the manifest entry file'
);
check(
  packageData.files?.[entryFile] === entryContents,
  'embedded entry file matches the local file'
);

const expectedPackage = {
  manifest,
  files: {
    [entryFile]: entryContents
  }
};

check(
  packageRaw === `${JSON.stringify(expectedPackage, null, 2)}\n`,
  'package.sapp.json is generated with the expected formatting'
);

if (entryFile === 'README.md') {
  check(entryContents.includes(`App id: \`${manifest.id}\``), 'README app id matches manifest');
  check(entryContents.includes(`Version: \`${manifest.version}\``), 'README version matches manifest');
  check(entryContents.includes(`Runtime: \`${manifest.runtime}\``), 'README runtime matches manifest');
  check(entryContents.includes(`Type: \`${manifest.type}\``), 'README type matches manifest');
}

if (failures.length > 0) {
  console.error(`\n${failures.length} package check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('\nPackage checks passed.');
}
