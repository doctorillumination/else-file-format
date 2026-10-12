'use strict';
// Isolated integration checks use synthetic files and a disposable profile.
const assert = require('node:assert/strict');
const { readFile, mkdir, mkdtemp, writeFile } = require('node:fs/promises');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const { _electron } = require('../node_modules/playwright');
const { assetName, externalLink, exportedBytes } = require('./boundary.cjs');
const root = path.dirname(__dirname);
const python = process.env.ELSE_PYTHON || 'python3';
const output = path.join(root, 'output', 'desktop-checks-' + process.platform);
const fixtures = path.join(root, 'output', 'browser-fixtures');
const checks = [];
checks.push = (...values) => { console.log(values.join('\n')); return Array.prototype.push.apply(checks, values); };

function inspect(filename) {
  const script = 'import reader,json,sys,base64; model,pdf=reader.read_package(sys.argv[1]); print(json.dumps({"model":model,"context":reader.ai_context(model),"pdf":base64.b64encode(pdf).decode()}))';
  return JSON.parse(execFileSync(python, ['-c', script, filename], { cwd: root, encoding: 'utf8' }));
}
async function untilFile(filename) {
  for (let count = 0; count < 100; count++) {
    try { return await readFile(filename); } catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
  }
  throw new Error('Expected saved file: ' + filename);
}
(async () => {
  await mkdir(output, { recursive: true });
  execFileSync(python, [path.join(root, 'browser_fixtures.py')], { cwd: root });
  const profile = await mkdtemp(path.join(os.tmpdir(), 'dotelse-test-profile-'));
  const original = path.join(fixtures, 'Local-reading.else');
  const originalBytes = await readFile(original);
  const expected = inspect(original);
  const inputPDF = await readFile(path.join(fixtures, 'Two-pages.pdf'));
  const electron = await _electron.launch({ executablePath: process.env.ELSE_DESKTOP_EXECUTABLE || require('electron'), args: [__dirname, original],
    env: { ...process.env, ELSE_TEST_USER_DATA: profile }, timeout: 60000 });
  try {
    const page = await electron.firstWindow();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('dialog', () => {});
    async function settled(state = 'local') {
      await page.waitForFunction((state) => document.body.dataset.readerState === state && document.querySelector('#drop-zone').getAttribute('aria-busy') === 'false', state);
    }
    async function chooser(filename) {
      await electron.evaluate(({ dialog }, filename) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filename] }); }, filename);
      await page.getByRole('button', { name: 'Choose PDF or .else file', exact: true }).click();
    }
    async function destination(filename) {
      await electron.evaluate(({ dialog }, filename) => { dialog.showSaveDialog = async () => filename ? { canceled: false, filePath: filename } : { canceled: true }; }, filename);
    }
    await settled();
    await page.waitForFunction(() => document.body.dataset.previewState === 'ready');
    assert.deepEqual(JSON.parse(await page.locator('#evidence-view').textContent()), expected.model);
    assert.equal(await page.locator('#context-view').textContent(), expected.context);
    assert.equal(await page.locator('#material-title img').count(), 0);
    checks.push('Opening a .else through a launch argument preserves literal source, attribution, context and a local PDF preview');

    const security = await electron.evaluate(({ BrowserWindow }) => {
      const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
      return { sandbox: preferences.sandbox, contextIsolation: preferences.contextIsolation, nodeIntegration: preferences.nodeIntegration };
    });
    assert.deepEqual(security, { sandbox: true, contextIsolation: true, nodeIntegration: false });
    assert.deepEqual(await page.evaluate(() => [typeof require, typeof process, Object.keys(window.elseDesktop).sort()]),
      ['undefined', 'undefined', ['chooseFile', 'confirmDiscard', 'dragPDF', 'onAction', 'onFile', 'pendingFile', 'saveFile']]);
    checks.push('The renderer is sandboxed and isolated, with no Node access or general filesystem bridge');

    assert.equal(assetName('app://else/preload.cjs', new Set(['index.html'])), null);
    assert.equal(assetName('app://else/%2e%2e%2fsecret', new Set(['index.html'])), null);
    assert.equal(externalLink('https://github.com/doctorillumination/else-file-format-private'), false);
    assert.equal(externalLink('https://github.com.evil.invalid/doctorillumination/else-file-format'), false);
    assert.throws(() => exportedBytes({ kind: 'pdf', name: '../outside.pdf', bytes: new Uint8Array(inputPDF) }));
    const denied = await electron.evaluate(async ({ session }) => {
      const local = session.fromPartition('else-local');
      const answers = [];
      for (const address of ['https://example.invalid/no-upload', 'app://else/preload.cjs', 'file:///outside-reader.txt']) {
        try { answers.push((await local.fetch(address)).status); } catch (error) { answers.push(error.message); }
      }
      return answers;
    });
    assert.ok(denied.every((answer) => typeof answer === 'string' && answer.includes('ERR_BLOCKED_BY_CLIENT')), JSON.stringify(denied));
    checks.push('Network, arbitrary file URLs, out-of-bundle paths and unsafe export names are rejected');

    await chooser(path.join(fixtures, 'Two-pages.pdf'));
    await settled('draft');
    assert.ok((await page.locator('#draft-text').textContent()).includes('SYNTHETIC_SECOND_PAGE'));
    await page.locator('#create-title').fill('Desktop creation sentinel');
    await page.locator('#source-creator').fill('Synthetic PDF creator');
    await page.locator('#source-description').fill('Declared origin: https://example.invalid/never-fetch');
    for (const number of [1, 2]) {
      await page.locator(`#reading-${number}-title`).fill('Desktop interpretation ' + number);
      await page.locator(`#reading-${number}-name`).fill('Synthetic contributor ' + number);
      await page.locator(`#reading-${number}-text`).fill('Desktop words ' + number + ': Café 🌿 <script>never execute</script>');
    }
    await page.locator('#reading-2-kind').selectOption('ai');
    assert.equal(await page.locator('#creation-form').evaluate((form) => form.checkValidity()), false);
    await page.locator('#reading-2-generator').fill('Synthetic AI test tool');
    await destination(null);
    await page.getByRole('button', { name: 'Save .else locally', exact: true }).click();
    await settled();
    await page.waitForFunction(() => document.querySelector('#open-status').textContent.includes('still unsaved'));
    await electron.evaluate(({ dialog }) => { dialog.showMessageBox = async () => ({ response: 0 }); });
    await page.getByRole('button', { name: 'Close file', exact: true }).click();
    assert.equal(await page.locator('body').getAttribute('data-reader-state'), 'local');
    checks.push('Creating from a PDF requires AI attribution, and cancelling a native save protects the unsaved package');

    const createdPath = path.join(output, 'Created.else');
    await destination(createdPath);
    await page.getByRole('link', { name: 'Save .else', exact: true }).click();
    await untilFile(createdPath);
    await page.waitForFunction(() => document.querySelector('#open-status').textContent.includes('saved on this computer'));
    const createdBytes = await readFile(createdPath);
    const created = inspect(createdPath);
    assert.deepEqual(Buffer.from(created.pdf, 'base64'), inputPDF);
    assert.equal(created.model.interpretations[0].author.kind, 'human');
    assert.equal(created.model.interpretations[1].author.generator, 'Synthetic AI test tool');
    assert.equal(await page.locator('#context-view').textContent(), created.context);
    checks.push('Desktop creation writes a compatible .else with exact PDF bytes and matching independent AI context');

    for (const [label, filename, expectedBytes] of [
      ['Save original PDF', 'Original.pdf', inputPDF],
      ['Save AI context', 'Context.md', Buffer.from(created.context)],
      ['Save .else', 'Package-copy.else', createdBytes]
    ]) {
      const filenamePath = path.join(output, filename);
      await destination(filenamePath);
      await page.getByRole('link', { name: label, exact: true }).click();
      assert.deepEqual(await untilFile(filenamePath), expectedBytes);
      await page.waitForFunction(() => document.querySelector('#drop-zone').getAttribute('aria-busy') === 'false');
    }
    checks.push('Native PDF, Markdown context and .else exports preserve the exact selected bytes');

    await chooser(createdPath); await settled();
    await page.getByRole('button', { name: 'Edit context', exact: true }).click();
    await settled('editing');
    assert.equal(await page.locator('#reading-2-generator').inputValue(), 'Synthetic AI test tool');
    await page.locator('#reading-1-text').fill('Cancelled change');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await page.locator('#context-view').textContent(), created.context);
    checks.push('Editing preloads attribution and cancellation restores the original validated model');

    await page.getByRole('button', { name: 'Edit context', exact: true }).click(); await settled('editing');
    await page.locator('#reading-1-text').fill('A desktop edit remains separate from the unchanged PDF.');
    await electron.evaluate(({ dialog, BrowserWindow }) => {
      dialog.unsavedPrompts = 0;
      dialog.showMessageBoxSync = () => { dialog.unsavedPrompts++; return 0; };
      BrowserWindow.getAllWindows()[0].close();
    });
    for (let count = 0; count < 50 && !await electron.evaluate(({ dialog }) => dialog.unsavedPrompts); count++) await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(await electron.evaluate(({ dialog }) => dialog.unsavedPrompts), 1);
    assert.equal(page.isClosed(), false);
    checks.push('Native window closing protects an unsaved edit when Keep working is chosen');

    const editedPath = path.join(output, 'Edited.else');
    await destination(editedPath);
    await page.getByRole('button', { name: 'Save edited .else', exact: true }).click();
    await untilFile(editedPath); await settled();
    const edited = inspect(editedPath);
    assert.deepEqual(Buffer.from(edited.pdf, 'base64'), inputPDF);
    assert.equal(edited.model.sourceText, created.model.sourceText);
    const previousSecond = created.model.interpretations[1];
    const nextSecond = edited.model.interpretations[1];
    assert.equal(nextSecond.target, edited.model.materialID);
    assert.deepEqual({ ...nextSecond, id: previousSecond.id, target: previousSecond.target }, previousSecond);
    assert.deepEqual(edited.model.interpretations.map((r) => r.author), created.model.interpretations.map((r) => r.author));
    assert.ok(edited.model.source.description.includes(createHash('sha256').update(createdBytes).digest('hex')));
    assert.deepEqual(await readFile(createdPath), createdBytes);
    assert.deepEqual(await readFile(original), originalBytes);
    assert.equal(await page.locator('#context-view').textContent(), edited.context);
    checks.push('Saving an edit retains the PDF, text derivative and contributors, records the prior fingerprint and leaves source files unchanged');

    await electron.evaluate(({ BrowserWindow }) => {
      const contents = BrowserWindow.getAllWindows()[0].webContents;
      contents.startDrag = (value) => { contents.testDragFile = value.file; };
    });
    await page.evaluate(async ({ bytes, name }) => window.elseDesktop.dragPDF({ bytes: new Uint8Array(bytes), name, kind: 'pdf' }),
      { bytes: Array.from(inputPDF), name: 'Ordinary-original.pdf' });
    const dragPath = await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.testDragFile);
    assert.deepEqual(await readFile(dragPath), inputPDF);
    assert.equal(await page.getByRole('button', { name: 'Drag original PDF out', exact: true }).getAttribute('draggable'), 'true');
    checks.push('The native drag bridge passes an exact ordinary PDF copy to the operating-system drag API');

    await chooser(path.join(fixtures, 'Unselected-note.else'));
    await page.locator('#open-error').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#context-view').textContent(), edited.context);
    assert.deepEqual(errors, []);
    checks.push('Unsupported private content is rejected without replacing the valid file or executing source text');
    await page.screenshot({ path: path.join(output, 'Desktop-reader.png'), fullPage: true });
    await writeFile(path.join(output, 'checks.json'), JSON.stringify({ platform: process.platform, checks }, null, 2) + '\n');
    console.log(JSON.stringify({ platform: process.platform, count: checks.length, checks }, null, 2));
  } finally {
    await electron.evaluate(({ app }) => app.exit(0)).catch(() => {});
    await electron.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
