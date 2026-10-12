// Isolated automated browser tests use synthetic files and a fresh test profile.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.ELSE_PLAYWRIGHT || 'playwright');
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output = path.join(root, 'output');
const fixtures = path.join(output, 'browser-fixtures');
const python = process.env.ELSE_PYTHON || 'python3';
await mkdir(output, { recursive: true });
execFileSync(python, [path.join(root, 'browser_fixtures.py')], { cwd: root });
const expected = JSON.parse(await readFile(path.join(fixtures, 'expected.json'), 'utf8'));
const expectedPDF = await readFile(path.join(fixtures, 'expected.pdf'));
const expectedContext = await readFile(path.join(fixtures, 'expected-context.md'));
const chosen = await readFile(path.join(fixtures, 'Local-reading.else'));
const fingerprint = createHash('sha256').update(chosen).digest('hex');
const checks = [];
const requests = [];
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const server = spawn(python, ['preview.py', '--port', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('error', reject);
  server.once('exit', (code) => reject(new Error('Preview exited: ' + code)));
});
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.ELSE_BROWSER ? { executablePath: process.env.ELSE_BROWSER } : {}) });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  context.on('request', (request) => { if (/^https?:/.test(request.url())) requests.push({ url: request.url(), method: request.method() }); });
  await page.goto('http://127.0.0.1:' + port + '/');
  await page.waitForFunction(() => document.body.dataset.previewState === 'ready' && document.querySelector('#drop-zone').getAttribute('aria-busy') === 'false');
  const baseline = requests.length;
  await context.setOffline(true);

  async function drop(data, name) {
    await page.evaluate(({ bytes, filename }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(bytes)], filename, { type: 'application/octet-stream' }));
      const target = document.querySelector('#drop-zone');
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    }, { bytes: Array.from(data), filename: name });
  }
  async function opened(name) {
    await page.waitForFunction((filename) => document.body.dataset.readerState === 'local' && document.querySelector('#open-status').textContent.startsWith(filename + ' open') && document.querySelector('#drop-zone').getAttribute('aria-busy') === 'false', name);
  }
  await drop(chosen, 'Local-reading.else');
  await opened('Local-reading.else');
  assert.equal(await page.locator('#material-title').innerText(), expected.title);
  assert.equal(await page.locator('#context-view').textContent(), expectedContext.toString('utf8'));
  assert.deepEqual(JSON.parse(await page.locator('#evidence-view').textContent()), expected);
  assert.equal(await page.locator('#pdf-page').textContent(), 'Page 1 of 1');
  assert.equal(await page.locator('#material-title img').count(), 0);
  assert.equal(await page.locator('#readings script').count(), 0);
  checks.push('Drag-in opens a changed package offline, with literal untrusted text and a local PDF preview');

  for (const [label, expectedBytes, filename] of [
    ['Save original PDF', expectedPDF, 'browser-original.pdf'],
    ['Save AI context', expectedContext, 'browser-context-download.md'],
    ['Save .else', chosen, 'browser-package-download.else']
  ]) {
    const pending = page.waitForEvent('download');
    await page.getByRole('link', { name: label, exact: true }).click();
    const download = await pending;
    const destination = path.join(output, filename);
    await download.saveAs(destination);
    assert.deepEqual(await readFile(destination), expectedBytes);
  }
  assert.equal(createHash('sha256').update(await readFile(path.join(fixtures, 'Local-reading.else'))).digest('hex'), fingerprint);
  checks.push('PDF, context and .else downloads preserve their exact expected bytes and leave the selected .else unchanged');

  for (const name of ['Unselected-note.else', 'Truncated.else']) {
    await drop(await readFile(path.join(fixtures, name)), name);
    await page.locator('#open-error').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('#drop-zone').getAttribute('aria-busy') === 'false');
    assert.equal(await page.locator('#material-title').innerText(), expected.title);
    assert.equal(await page.locator('#context-view').textContent(), expectedContext.toString('utf8'));
    assert.ok(!(await page.locator('body').textContent()).includes('UNSELECTED_PRIVATE_SENTINEL_DO_NOT_EXPORT'));
  }
  checks.push('Malformed and unselected-content files are rejected without replacing the valid view or leaking omitted notes');

  const chooserPending = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose PDF or .else file', exact: true }).focus();
  await page.keyboard.press('Enter');
  const chooser = await chooserPending;
  await chooser.setFiles(path.join(fixtures, 'Local-reading.else'));
  await opened('Local-reading.else');
  assert.equal(await page.locator('#open-error').isVisible(), false);
  checks.push('Keyboard-accessible file selection opens the same local package');

  await page.evaluate(async (bytes) => {
    const target = document.querySelector('#drop-zone');
    const dispatch = (file) => {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    };
    let finished;
    const done = new Promise((resolve) => { finished = resolve; });
    class SlowFile extends File {
      async arrayBuffer() {
        await new Promise((resolve) => setTimeout(resolve, 150));
        const buffer = await super.arrayBuffer();
        finished();
        return buffer;
      }
    }
    dispatch(new SlowFile([new Uint8Array(bytes)], 'Older-slow.else'));
    dispatch(new File([new Uint8Array(bytes)], 'Newest-choice.else'));
    await done;
  }, Array.from(chosen));
  await opened('Newest-choice.else');
  checks.push('A slower earlier file cannot overwrite the latest selected file');

  async function drafted(name) {
    await page.waitForFunction((filename) => document.body.dataset.readerState === 'draft' && document.querySelector('#draft-name').textContent.startsWith(filename) && document.querySelector('#drop-zone').getAttribute('aria-busy') === 'false', name);
  }
  async function fillCreation() {
    await page.locator('#create-title').fill('LOCAL_CREATION_SENTINEL: A PDF with two readings ✓');
    await page.locator('#source-creator').fill('Synthetic source creator');
    await page.locator('#source-description').fill('Synthetic provenance: https://example.invalid/never-fetch\nA source link remains declared text.');
    for (const number of [1, 2]) {
      await page.locator(`#reading-${number}-title`).fill('Reading ' + number + ' <img src="https://example.invalid/no-fetch">');
      await page.locator(`#reading-${number}-name`).fill('Example person ' + number);
      await page.locator(`#reading-${number}-text`).fill('\n  Synthetic interpretation ' + number + ': Café, a leaf 🌿. <script>fetch("https://example.invalid/do-not-send")</script>\n');
    }
  }
  async function saveCreated(filename) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save .else locally', exact: true }).click();
    const download = await pending;
    assert.equal(download.suggestedFilename(), filename);
    const destination = path.join(output, filename);
    await download.saveAs(destination);
    await page.waitForFunction(() => document.body.dataset.readerState === 'local' && document.body.dataset.previewState === 'ready' && document.querySelector('#drop-zone').getAttribute('aria-busy') === 'false');
    const independent = JSON.parse(execFileSync(python, ['-c', 'import sys,json,reader; model,pdf=reader.read_package(sys.argv[1]); print(json.dumps({"model":model,"context":reader.ai_context(model)},ensure_ascii=False))', destination], { cwd: root, encoding: 'utf8' }));
    assert.deepEqual(JSON.parse(await page.locator('#evidence-view').textContent()), independent.model);
    assert.equal(await page.locator('#context-view').textContent(), independent.context);
    const native = path.join(output, 'Else Experiment.app/Contents/MacOS/ElseExperiment');
    if (existsSync(native)) {
      assert.deepEqual(JSON.parse(execFileSync(native, ['--inspect', destination], { encoding: 'utf8' })), independent.model);
      assert.equal(execFileSync(native, ['--context', destination], { encoding: 'utf8' }), independent.context);
    }
    return { destination, ...independent };
  }

  await drop(expectedPDF, 'My-study-✓.pdf');
  await drafted('My-study-✓.pdf');
  assert.deepEqual((await page.locator('#draft-text').textContent()).split(/\s+/), expected.sourceText.trim().split(/\s+/));
  assert.equal(await page.locator('#reader-view').isVisible(), false);
  const draftDownload = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Save original PDF', exact: true }).click();
  const draftDestination = path.join(output, 'draft-original.pdf');
  await (await draftDownload).saveAs(draftDestination);
  assert.deepEqual(await readFile(draftDestination), expectedPDF);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  assert.equal(await page.locator('#creator').isVisible(), false);
  assert.equal(await page.locator('#material-title').innerText(), expected.title);
  checks.push('Dropping a PDF extracts text locally; cancelling returns to the prior valid reader without altering its file');

  await drop(await readFile(path.join(fixtures, 'Not-a-PDF.pdf')), 'Not-a-PDF.pdf');
  await page.locator('#open-error').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#creator').isVisible(), false);
  assert.equal(await page.locator('#material-title').innerText(), expected.title);
  checks.push('A false PDF is rejected before replacing the valid reader');

  const pdfChooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose PDF or .else file', exact: true }).click();
  await (await pdfChooser).setFiles(path.join(fixtures, 'Two-pages.pdf'));
  await drafted('Two-pages.pdf');
  assert.ok((await page.locator('#draft-text').textContent()).includes('SYNTHETIC_FIRST_PAGE'));
  assert.ok((await page.locator('#draft-text').textContent()).includes('SYNTHETIC_SECOND_PAGE'));
  await fillCreation();
  await page.locator('#reading-2-kind').selectOption('ai');
  assert.equal(await page.locator('#reading-2-generator').isVisible(), true);
  assert.equal(await page.locator('#creation-form').evaluate((form) => form.checkValidity()), false);
  await page.locator('#reading-2-generator').fill('Synthetic AI test tool');
  assert.equal(await page.locator('#creation-form').evaluate((form) => form.checkValidity()), true);
  await page.locator('#create-title').fill(' ');
  await page.getByRole('button', { name: 'Save .else locally', exact: true }).click();
  await page.locator('#open-error').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#creator').isVisible(), true);
  assert.ok((await page.locator('#reading-1-text').inputValue()).includes('Synthetic interpretation'));
  await page.locator('#create-title').fill('LOCAL_CREATION_SENTINEL: A PDF with two readings ✓');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({ path: path.join(output, 'Creation-form-preview.png'), fullPage: true });
  const created = await saveCreated('Two-pages.else');
  assert.equal(created.model.interpretations[0].author.kind, 'human');
  assert.equal(created.model.interpretations[1].author.kind, 'ai');
  assert.ok(created.model.interpretations[0].text.startsWith('\n  Synthetic interpretation'));
  assert.ok(created.model.interpretations[0].text.endsWith('\n'));
  assert.ok(created.context.includes('experimental human contribution'));
  assert.ok(created.context.includes('Synthetic AI test tool'));
  assert.ok(created.context.includes('https://example.invalid/never-fetch'));
  assert.equal(await page.locator('#readings img, #readings script').count(), 0);
  checks.push('PDF picker and two-page extraction feed creation; required AI attribution, draft preservation after validation failure, narrow layout and independent reader round-trip all pass');

  const twoPagesPDF = await readFile(path.join(fixtures, 'Two-pages.pdf'));
  for (const [label, expectedBytes, filename] of [
    ['Save original PDF', twoPagesPDF, 'created-original.pdf'],
    ['Save AI context', Buffer.from(created.context), 'created-context.md']
  ]) {
    const pending = page.waitForEvent('download');
    await page.getByRole('link', { name: label, exact: true }).click();
    const destination = path.join(output, filename);
    await (await pending).saveAs(destination);
    assert.deepEqual(await readFile(destination), expectedBytes);
  }
  await drop(await readFile(created.destination), 'Two-pages.else');
  await opened('Two-pages.else');
  assert.equal(await page.locator('#context-view').textContent(), created.context);
  assert.equal(await page.locator('#pdf-page').textContent(), 'Page 1 of 2');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#pdf-page').textContent === 'Page 2 of 2');
  checks.push('A created .else reopens locally, previews both pages and exports the exact original PDF and independent AI context');

  await drop(await readFile(path.join(fixtures, 'No-selectable-text.pdf')), 'No-selectable-text.pdf');
  await drafted('No-selectable-text.pdf');
  assert.ok((await page.locator('#extraction-note').textContent()).includes('no selectable text'));
  await fillCreation();
  assert.equal(await page.locator('#reading-2-generator').isVisible(), false);
  const blank = await saveCreated('No-selectable-text.else');
  assert.ok(blank.model.sourceText.includes('No OCR or transcription was performed'));
  assert.deepEqual(blank.model.interpretations.map((reading) => reading.author.kind), ['human', 'human']);
  checks.push('A PDF without selectable text can be carried unchanged, with explicit extraction limits and two human contributions');

  const localUseRequests = requests.slice(baseline);
  assert.deepEqual(localUseRequests, []);
  assert.deepEqual(errors, []);
  checks.push('Reading, PDF text extraction, creation, previewing and all downloads make zero HTTP requests while offline');

  await drop(expectedPDF, 'Unsaved.pdf');
  await drafted('Unsaved.pdf');
  await page.locator('#source-description').fill('UNSAVED_DRAFT_SENTINEL');
  await context.setOffline(false);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.readerState === 'specimen' && document.body.dataset.previewState === 'ready' && document.querySelector('#drop-zone').getAttribute('aria-busy') === 'false');
  assert.ok(!(await page.locator('#context-view').textContent()).includes('LOCAL_CONTEXT_SENTINEL'));
  assert.equal(await page.locator('#creator').isVisible(), false);
  assert.equal(await page.locator('#source-description').inputValue(), '');
  assert.equal(await page.locator('#draft-text').textContent(), '');
  checks.push('Reload returns to the public specimen and clears both the local file view and an unsaved draft');

  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  checks.push('The opener, preview and export controls fit a narrow mobile viewport');
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.screenshot({ path: path.join(output, 'Local-reader-preview.png'), fullPage: true });
  await writeFile(path.join(output, 'browser-checks.json'), JSON.stringify({ passed: checks.length, checks, requestsDuringLocalUse: localUseRequests, initialPageRequests: baseline }, null, 2) + '\n');
  console.log(checks.length + ' browser checks passed');
} finally {
  await browser?.close();
  server.kill();
}
