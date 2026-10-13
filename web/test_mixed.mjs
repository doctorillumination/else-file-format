import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium, webkit, _electron } from 'playwright';
import { readMixed, mixedContext, writeMixed, include, newEdition, encoded } from './mixed-format.mjs';
import { storedZIP } from './create.mjs';
import { digest } from './format.mjs';
const root = new URL('../', import.meta.url), out = new URL('../output/mixed-checks/', import.meta.url), python = process.env.ELSE_PYTHON || 'python3';
const filePath = u => fileURLToPath(u);
const carry = process.env.ELSE_CARRY_TOOL;
await mkdir(out, { recursive: true });
const checks = [], check = s => { checks.push(s); console.log(s); };
const server = createServer(async (req, res) => { try { const url = new URL(req.url, 'http://localhost'), path = url.pathname === '/' ? '/index.html' : url.pathname; if (!/^\/(?:[a-z-]+\.(?:html|mjs|css)|vendor\/pdf(?:\.worker)?\.mjs)$/.test(path)) throw Error(); const b = await readFile(new URL('docs' + path, root)); res.setHeader('Content-Type', path.endsWith('.html') ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'text/javascript'); res.end(b); } catch { res.writeHead(404); res.end(); } });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const origin = 'http://127.0.0.1:' + server.address().port;
const original = await readFile(new URL('Input.else', out)), pdf = await readFile(new URL('../output/browser-fixtures/Two-pages.pdf', import.meta.url)), wav = await readFile(new URL('Voice.wav', out));
async function details(page, tab) {
  if (!await page.locator('#mixed-inspector').evaluate(d => d.open)) await page.locator('.reading-tools').getByRole('button', { name: 'Details', exact: true }).click();
  await page.locator('#mixed-inspector').getByRole('tab', { name: tab, exact: true }).click();
}
async function closeDetails(page) { if (await page.locator('#mixed-inspector').evaluate(d => d.open)) await page.locator('#mixed-inspector').getByRole('button', { name: 'Done', exact: true }).click(); }
async function download(page, label, expected) {
  let target;
  if (await page.locator('#mixed-form').count()) target = page.getByRole('button', { name: label, exact: true });
  else { await details(page, 'Export'); target = page.locator('#mixed-inspector').getByRole('button', { name: label, exact: true }); }
  const waiting = page.waitForEvent('download'); await target.click(); const d = await waiting, bytes = await readFile(await d.path());
  if (expected) assert.deepEqual(bytes, Buffer.from(expected)); if (!await page.locator('#mixed-form').count()) await closeDetails(page); return bytes;
}
async function fillNew(page, name) {
  await page.locator('#mixed-pdf').setInputFiles(filePath(new URL('../output/browser-fixtures/Two-pages.pdf', import.meta.url)));
  await page.locator('#mixed-voice').setInputFiles(filePath(new URL('Voice.wav', out)));
  for (const [id, value] of Object.entries({ title: 'Mixed created in ' + name, editor: 'Synthetic browser contributor', 'pdf-title': 'Original PDF', 'pdf-creator': 'Synthetic fixture', 'social-url': 'https://x.com/jack/status/20', 'social-title': 'A post', 'social-creator': 'Declared account', 'youtube-url': 'https://youtu.be/M7lc1UVf-VE', 'youtube-title': 'A video passage', 'youtube-creator': 'Declared channel', start: '2', end: '8', contributor: 'Synthetic browser contributor', note: 'A literal note: Café 🌿 <script>never execute</script>', transcript: '[Synthetic tone, no spoken words]' })) await page.locator('#mixed-' + id).fill(value);
}
async function load(page, path) { const expected = (await readMixed(await readFile(path))).manifest.heads[0]; await page.locator('#mixed-open-input').setInputFiles(filePath(path)); await page.waitForFunction(expected => window.mixedReader?.head === expected, expected); }
try {
  for (const [name, engine] of [['Chromium', chromium], ['WebKit', webkit]].filter(([name]) => !process.env.ELSE_BROWSER_ENGINES || process.env.ELSE_BROWSER_ENGINES.toLowerCase().includes(name.toLowerCase()))) {
    const browser = await engine.launch(); const context = await browser.newContext({ acceptDownloads: true }), page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await context.route('https://**/*', route => route.abort());
    try {
      await page.goto(origin + '/mixed.html'); await page.locator('#mixed-form').waitFor();
      await fillNew(page, name); const bytes = await download(page, 'Save .else copy');
      const model = await readMixed(bytes); assert.deepEqual(Buffer.from(model.blob(model.materials[model.editions[model.manifest.heads[0]].materials[0]].blob)), pdf);
      const voice = Object.values(model.contexts).find(c => c.audio); assert.deepEqual(Buffer.from(model.blob(voice.audio)), wav);
      assert.equal(Object.values(model.materials).find(m => m.kind === 'youtube').end, 8);
      const path = new URL('Browser-' + name + '.else', out); await writeFile(path, bytes);
      execFileSync(python, [filePath(new URL('../mixed_reader.py', import.meta.url)), filePath(path)]);
      if (carry) execFileSync(carry, ['verify-mixed', filePath(path)]);
      check(name + ': local creation, voice metadata, Unicode and original bytes pass independent validation');
      assert.equal(await page.locator('#mixed-inspector').evaluate(d => d.open), false);
      await page.getByRole('button', { name: 'Expand original PDF: Original PDF', exact: true }).click();
      await page.locator('.pdf-dialog').getByText('Page 1 of 2', { exact: true }).waitFor();
      await page.locator('.pdf-dialog').getByRole('button', { name: 'Next PDF page', exact: true }).click();
      await page.locator('.pdf-dialog').getByText('Page 2 of 2', { exact: true }).waitFor();
      await page.locator('.pdf-dialog').getByRole('button', { name: 'Done', exact: true }).click();
      const beforeVideo = await page.locator('.video-frame iframe').getAttribute('src');
      await page.getByRole('button', { name: 'Expand video', exact: true }).click();
      assert.equal(await page.locator('.video-frame iframe').getAttribute('src'), beforeVideo);
      await page.getByRole('button', { name: 'Close expanded video', exact: true }).click();
      assert.equal(await page.locator('.reading-tools').evaluate(e => e.inert), false);
      check(name + ': PDF expands and pages correctly, video expansion retains its frame, details stay behind the reading');
      await download(page, 'Save original PDF', pdf); await download(page, 'Save original voice', wav); await download(page, 'Save AI context', new TextEncoder().encode(mixedContext(model)));
      await page.locator('audio').evaluate(a => a.play()); await page.waitForFunction(() => document.querySelector('audio').currentTime > 0); check(name + ': ordinary extraction and actual audio playback work');
      await load(page, new URL('Response.else', out)); await details(page, 'Proofs'); await page.getByText('Synthetic peer', { exact: true }).first().waitFor(); await closeDetails(page);
      await details(page, 'Export'); assert.equal(await page.locator('#mixed-ai-context').textContent(), mixedContext(await readMixed(await readFile(new URL('Response.else', out))))); await details(page, 'Proofs');
      assert.ok((await page.locator('#mixed-content').textContent()).includes('Signature valid')); await closeDetails(page);
      if (process.env.ELSE_PHONE_FILE) {
        const phone = new URL('file://' + process.env.ELSE_PHONE_FILE), phoneModel = await readMixed(await readFile(phone));
        await load(page, phone); await details(page, 'Export'); assert.equal(await page.locator('#mixed-ai-context').textContent(), mixedContext(phoneModel));
        assert.equal(new Set(phoneModel.proofs.map(p => p.publicKey)).size, 2); await closeDetails(page);
        check(name + ': actual two-phone Keychain exchange opens with both keys and identical context');
      }
      await context.setOffline(true); let localRequests = 0; page.on('request', req => { if (/^https?:/.test(req.url()) && req.frame() === page.mainFrame()) localRequests++; });
      await page.getByRole('button', { name: 'Add interpretation', exact: true }).first().click(); await page.locator('#mixed-editor').fill('Synthetic browser editor'); await page.locator('#mixed-contributor').fill('Synthetic browser contributor'); await page.locator('#mixed-note').fill('An offline response in ' + name);
      const edited = await download(page, 'Save .else copy'); const next = await readMixed(edited); assert.equal(next.proofs.length, process.env.ELSE_PHONE_FILE ? 3 : 2); assert.equal(Object.keys(next.editions).length, process.env.ELSE_PHONE_FILE ? 4 : 3); assert.equal(localRequests, 0);
      await writeFile(new URL('Edited-' + name + '.else', out), edited); check(name + ': signed history survives offline editing with zero reader HTTP requests');
      await page.getByRole('button', { name: 'Example', exact: true }).click(); await page.getByRole('heading', { name: 'A few things, carried together', exact: true }).waitFor(); check(name + ': public visual example opens without uploaded files');
      assert.deepEqual(errors, []); await page.screenshot({ path: filePath(new URL(name + '.png', out)), fullPage: true });
    } finally { await browser.close(); }
  }
  const baseline = await readMixed(original), files = new Map(baseline.files), ctx = baseline.editions[baseline.manifest.heads[0]].contexts;
  const a = await newEdition(baseline, { title: 'Branch A', editor: 'Synthetic A', materials: baseline.editions[baseline.manifest.heads[0]].materials, contexts: ctx });
  const ma = await readMixed(a), branch = await newEdition(ma, { title: 'Branch B', editor: 'Synthetic B', materials: baseline.editions[baseline.manifest.heads[0]].materials, contexts: ctx, parents: baseline.manifest.heads });
  const mb = await readMixed(branch); assert.equal(mb.manifest.heads.length, 2);
  const merged = await newEdition(mb, { title: 'Combined choice', editor: 'Synthetic editor', materials: baseline.editions[baseline.manifest.heads[0]].materials, contexts: ctx, parents: mb.manifest.heads });
  assert.equal((await readMixed(merged)).manifest.heads.length, 1); check('Concurrent branches remain explicit and a chosen merge retains both parents');
  async function unchecked(entries, path) { const next = new Map(entries); next.delete('integrity/files.json'); const index = {}; for (const [p, b] of next) index[p] = { sha256: await digest(b), bytes: b.length }; next.set('integrity/files.json', encoded({ files: index })); await writeFile(path, storedZIP(next)); }
  const signed = await readMixed(await readFile(new URL('Response.else', out)));
  const tampered = new Map(signed.files), proofID = signed.manifest.proofs[1], proof = { ...signed.proofRecords[proofID] }; proof.signature = proof.signature.replace(/^./, proof.signature[0] === 'A' ? 'B' : 'A');
  tampered.delete('proofs/' + proofID + '.json'); const changed = await include(tampered, 'proofs', proof); const manifest = { ...signed.manifest, proofs: [signed.manifest.proofs[0], changed] }; tampered.set('manifest.json', encoded(manifest));
  const badProof = new URL('Invalid-signature.else', out); await unchecked(tampered, badProof);
  const extra = new Map(files); await include(extra, 'blobs', new TextEncoder().encode('PRIVATE_BAG_NOTE_SENTINEL')); const badPrivate = new URL('Private-entry.else', out); await unchecked(extra, badPrivate);
  for (const p of [badProof, badPrivate]) {
    await assert.rejects(readMixed(await readFile(p)));
    assert.throws(() => execFileSync(python, [filePath(new URL('../mixed_reader.py', import.meta.url)), filePath(p)], { stdio: 'pipe' }));
    if (carry) assert.throws(() => execFileSync(carry, ['verify-mixed', filePath(p)], { stdio: 'pipe' }));
  }
  check('All independent validators reject altered signatures and unselected private content');
  const profile = await mkdtemp(tmpdir() + '/dotelse-mixed-test-');
  const electron = await _electron.launch({ executablePath: process.env.ELSE_DESKTOP_EXECUTABLE || createRequire(new URL('../desktop/package.json', import.meta.url))('electron'), args: [filePath(new URL('../desktop', import.meta.url))], env: { ...process.env, ELSE_TEST_USER_DATA: profile } });
  try {
    const page = await electron.firstWindow(); await page.waitForLoadState('load'); await page.waitForFunction(() => document.querySelector('#drop-zone')?.getAttribute('aria-busy') === 'false'); await page.getByRole('link', { name: 'Compose a mixed .else: PDF, post, passage and voice', exact: true }).click(); await page.locator('#mixed-form').waitFor();
    const destination = filePath(new URL('Desktop-created.else', out)); await electron.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, destination);
    await fillNew(page, 'macOS desktop'); await page.getByRole('button', { name: 'Save .else copy', exact: true }).click(); await page.getByText('Saved locally. Source files and earlier contributions stay intact.', { exact: true }).waitFor();
    const m = await readMixed(await readFile(destination)); assert.equal(Object.values(m.materials).find(v => v.kind === 'youtube').start, 2); check('macOS application creates the same profile through its native save bridge');
    await electron.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, filePath(new URL('Response.else', out)));
    await page.getByRole('button', { name: 'Open .else', exact: true }).click(); await details(page, 'Proofs'); await page.getByText('Synthetic peer', { exact: true }).first().waitFor(); await closeDetails(page);
    if (process.env.ELSE_PHONE_FILE) {
      await electron.evaluate(({ dialog }, filePath) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] }); }, process.env.ELSE_PHONE_FILE);
      await page.getByRole('button', { name: 'Open .else', exact: true }).click(); await page.getByText('Synthetic peer simulator', { exact: true }).waitFor();
      check('macOS application opens the actual two-phone exchange and verifies its public proofs');
    }
    await electron.evaluate(({ dialog }) => { dialog.showSaveDialog = async () => ({ canceled: true }); });
    await page.getByRole('button', { name: 'Add interpretation', exact: true }).first().click(); await page.locator('#mixed-editor').fill('Synthetic desktop editor'); await page.locator('#mixed-contributor').fill('Synthetic desktop contributor'); await page.locator('#mixed-note').fill('A desktop response'); await page.getByRole('button', { name: 'Save .else copy', exact: true }).click(); await page.getByText('Save cancelled. Your new edition is still unsaved.', { exact: true }).waitFor();
    await electron.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 0 }); }); await page.getByRole('button', { name: 'Close file', exact: true }).click(); assert.equal(await page.locator('#mixed-title').count(), 0); assert.ok(await page.locator('#mixed-app').isVisible());
    check('macOS signed imports and cancelled-save protection work in the application');
    const desktopReturn = filePath(new URL('Desktop-return.else', out)); await electron.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, desktopReturn); await details(page, 'Export'); await page.locator('#mixed-inspector').getByRole('button', { name: 'Save .else copy', exact: true }).click(); await closeDetails(page); await page.waitForTimeout(150); await readMixed(await readFile(desktopReturn));
    for (const [label, expected, name] of [['Save original PDF', pdf, 'Desktop-original.pdf'], ['Save original voice', wav, 'Desktop-voice.wav']]) { const path = filePath(new URL(name, out)); await electron.evaluate(({ dialog }, filePath) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath }); }, path); await details(page, 'Export'); await page.locator('#mixed-inspector').getByRole('button', { name: label, exact: true }).click(); await closeDetails(page); await page.waitForTimeout(150); assert.deepEqual(await readFile(path), expected); }
    await page.screenshot({ path: filePath(new URL('Desktop.png', out)), fullPage: true }); check('macOS native extraction returns exact PDF and voice bytes');
  } finally { await electron.evaluate(({ app }) => app.exit(0)).catch(() => {}); await electron.close(); }
  await writeFile(new URL('checks.json', out), JSON.stringify({ checks }, null, 2));
} finally { server.close(); }
