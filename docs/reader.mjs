import { MAX_ARCHIVE, readPackage, aiContext, contextBytes } from './format.mjs';
import { previewPDF } from './preview.mjs';

const zone = document.querySelector('#drop-zone');
const input = document.querySelector('#package-file');
const choose = document.querySelector('#choose-file');
const status = document.querySelector('#open-status');
const errorMessage = document.querySelector('#open-error');
const pdfLink = document.querySelector('#save-pdf');
const contextLink = document.querySelector('#save-context');
const readings = document.querySelector('#readings');
const contextView = document.querySelector('#context-view');
const evidenceView = document.querySelector('#evidence-view');
let revision = 0;
let current = null;
let urls = [];
let busy = false;

function setBusy(value) {
  busy = value;
  choose.disabled = value;
  zone.setAttribute('aria-busy', String(value));
  for (const link of [pdfLink, contextLink]) link.setAttribute('aria-disabled', String(value));
}

function element(tag, words, className) {
  const node = document.createElement(tag);
  node.textContent = words;
  if (className) node.className = className;
  return node;
}

async function render(result, name, demo) {
  const { model, pdf } = result;
  const nextURLs = [URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' })),
    URL.createObjectURL(new Blob([contextBytes(model)], { type: 'text/markdown;charset=utf-8' }))];
  pdfLink.href = nextURLs[0];
  pdfLink.download = model.filename;
  contextLink.href = nextURLs[1];
  contextLink.download = 'context.md';
  document.querySelector('#material-title').textContent = model.title;
  document.querySelector('#byte-status').textContent = 'Included bytes checked · unsigned · ' + (demo ? 'public specimen' : 'local file');
  readings.replaceChildren(...model.interpretations.map((reading, index) => {
    const card = document.createElement('article');
    card.append(element('span', `Reading ${index + 1} / ${reading.author.kind} demonstration`, 'eyebrow'),
      element('h2', reading.title), element('p', reading.text),
      element('small', reading.author.name + ' · ' + reading.author.role));
    return card;
  }));
  contextView.textContent = aiContext(model);
  evidenceView.textContent = JSON.stringify(model, null, 2);
  document.querySelector('#source-view').textContent = model.sourceText;
  current = { name, demo };
  status.textContent = (demo ? 'Public specimen open. ' : name + ' open on this device. ') + 'Original bytes checked. Nothing uploaded.';
  document.body.dataset.readerState = demo ? 'specimen' : 'local';
  for (const url of urls) URL.revokeObjectURL(url);
  urls = nextURLs;
  await previewPDF(pdf);
}

async function openBytes(bytes, name, demo = false, token = ++revision) {
  if (token !== revision) return;
  setBusy(true);
  errorMessage.hidden = true;
  status.textContent = 'Checking ' + name + ' on this device…';
  try {
    const result = await readPackage(bytes);
    if (token !== revision) return;
    await render(result, name, demo);
  } catch (error) {
    if (token !== revision) return;
    errorMessage.textContent = 'Could not open ' + name + '. ' + error.message + (current ? ' The previous file is still open.' : '');
    errorMessage.hidden = false;
    status.textContent = current ? current.name + ' remains open. Nothing uploaded.' : 'Choose a supported .else file. Nothing uploaded.';
  } finally {
    if (token === revision) setBusy(false);
  }
}

async function openFiles(files) {
  const token = ++revision;
  setBusy(false);
  status.textContent = current ? current.name + ' remains open. Nothing uploaded.' : 'Choose a supported .else file. Nothing uploaded.';
  if (files.length !== 1) {
    errorMessage.textContent = 'Choose one .else file at a time.';
    errorMessage.hidden = false;
    return;
  }
  const file = files[0];
  if (!/\.else$/i.test(file.name) || file.size > MAX_ARCHIVE) {
    errorMessage.textContent = 'Choose a .else file no larger than 64 MiB.';
    errorMessage.hidden = false;
    return;
  }
  // Chosen bytes stay in memory. The reader never sends or persists them.
  setBusy(true);
  errorMessage.hidden = true;
  status.textContent = 'Checking ' + file.name + ' on this device…';
  try {
    const bytes = await file.arrayBuffer();
    await openBytes(bytes, file.name, false, token);
  } catch {
    if (token !== revision) return;
    errorMessage.textContent = 'This device could not read the chosen file. Nothing was uploaded.';
    errorMessage.hidden = false;
    status.textContent = current ? current.name + ' remains open. Nothing uploaded.' : 'Choose a supported .else file. Nothing uploaded.';
  } finally {
    if (token === revision) setBusy(false);
  }
}

choose.disabled = false;
choose.addEventListener('click', () => input.click());
input.addEventListener('change', () => {
  const files = Array.from(input.files);
  input.value = '';
  void openFiles(files);
});
for (const link of [pdfLink, contextLink]) {
  link.addEventListener('click', (event) => { if (busy) event.preventDefault(); });
}
document.addEventListener('dragover', (event) => {
  if (Array.from(event.dataTransfer?.types ?? []).includes('Files')) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    zone.classList.add('drag-over');
  }
});
document.addEventListener('dragleave', (event) => {
  if (!event.relatedTarget) zone.classList.remove('drag-over');
});
document.addEventListener('drop', (event) => {
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (!Array.from(event.dataTransfer?.types ?? []).includes('Files')) return;
  event.preventDefault();
  zone.classList.remove('drag-over');
  void openFiles(files);
});
window.addEventListener('pagehide', (event) => { if (!event.persisted) for (const url of urls) URL.revokeObjectURL(url); });

const specimen = document.querySelector('#initial-package').content.textContent.trim();
const bytes = Uint8Array.from(atob(specimen), (character) => character.charCodeAt(0));
await openBytes(bytes, 'One-file-two-readings.else', true);
