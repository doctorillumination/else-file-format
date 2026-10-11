// Node test interface for the same module shipped to the browser.
import { readFile, writeFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { readPackage, aiContext } from './format.mjs';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
try {
  const [command, path, output] = process.argv.slice(2);
  const { model, pdf } = await readPackage(await readFile(path));
  if (command === '--inspect') console.log(JSON.stringify(model));
  else if (command === '--context') process.stdout.write(aiContext(model));
  else if (command === '--extract' && output) await writeFile(output, pdf, { flag: 'wx' });
  else throw new Error('Use --inspect, --context or --extract with a package path.');
} catch (error) {
  console.error('Cannot read specimen: ' + error.message);
  process.exitCode = 1;
}
