// Synthetic creation fixture and boundary checks, independent readers check the output.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { writePackage } from './create.mjs';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const [sourcePath, outputPath] = process.argv.slice(2);
const original = await readFile(sourcePath);
const spec = { pdf: new Uint8Array(original), filename: 'Synthetic-✓.pdf', title: 'Local creation <img> ✓',
  source: { kind: 'user-declared', creator: 'Synthetic source', description: 'Test source: https://example.invalid/pdf\nNo external source was fetched.' },
  sourceText: 'Synthetic extracted text, checked separately from the unchanged PDF.',
  interpretations: [
    { title: 'Human reading', text: 'Synthetic human words. <script>literal</script> ✓',
      author: { kind: 'human', name: 'Example person', role: 'Interpretation 1', generator: 'Not applicable (human-written)' } },
    { title: 'AI reading', text: 'Synthetic machine words, independently labelled.',
      author: { kind: 'ai', name: 'Example model', role: 'Interpretation 2', generator: 'Synthetic model fixture' } }
  ] };
for (const changes of [
  { filename: '../outside.pdf' }, { filename: 'Wrong.txt' }, { pdf: new Uint8Array([0, 1]) },
  { pdf: new Uint8Array(12 * 1024 * 1024 + 1) }, { title: ' ' }, { sourceText: '' },
  { sourceText: 'x'.repeat(65537) }, { interpretations: spec.interpretations.slice(0, 1) },
  { interpretations: spec.interpretations.map((reading) => ({ ...reading, author: { ...reading.author, kind: 'unknown' } })) }
]) await assert.rejects(writePackage({ ...spec, ...changes }));
const bytes = await writePackage(spec);
await writeFile(outputPath, bytes, { flag: 'wx' });
assert.deepEqual(spec.pdf, new Uint8Array(original));
console.log('9 writer boundaries checked; synthetic .else saved for independent validation');
