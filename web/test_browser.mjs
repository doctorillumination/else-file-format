// Isolated automated browser tests use synthetic files and a fresh test profile.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
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
    ['Save AI context', expectedContext, 'browser-context-download.md']
  ]) {
    const pending = page.waitForEvent('download');
    await page.getByRole('link', { name: label, exact: true }).click();
    const download = await pending;
    const destination = path.join(output, filename);
    await download.saveAs(destination);
    assert.deepEqual(await readFile(destination), expectedBytes);
  }
  assert.equal(createHash('sha256').update(await readFile(path.join(fixtures, 'Local-reading.else'))).digest('hex'), fingerprint);
  checks.push('Both downloads preserve their exact expected bytes and leave the selected .else unchanged');

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
  await page.getByRole('button', { name: 'Choose .else file', exact: true }).focus();
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

  const localUseRequests = requests.slice(baseline);
  assert.deepEqual(localUseRequests, []);
  assert.deepEqual(errors, []);
  checks.push('Opening, previewing, rejecting and exporting files make zero HTTP requests after page load');

  await context.setOffline(false);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.readerState === 'specimen' && document.body.dataset.previewState === 'ready' && document.querySelector('#drop-zone').getAttribute('aria-busy') === 'false');
  assert.ok(!(await page.locator('#context-view').textContent()).includes('LOCAL_CONTEXT_SENTINEL'));
  checks.push('Reload returns to the public specimen and clears the local file view');

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
