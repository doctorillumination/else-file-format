import { MAX_ARCHIVE, MAX_ENTRY, readPackage, aiContext, contextBytes } from './format.mjs';
import { previewPDF, extractPDFText } from './preview.mjs';
import { pdfFilename, writePackage } from './create.mjs';

const zone = document.querySelector('#drop-zone');
const input = document.querySelector('#package-file');
const choose = document.querySelector('#choose-file');
const status = document.querySelector('#open-status');
const errorMessage = document.querySelector('#open-error');
const pdfLink = document.querySelector('#save-pdf');
const contextLink = document.querySelector('#save-context');
const packageLink = document.querySelector('#save-package');
const readings = document.querySelector('#readings');
const contextView = document.querySelector('#context-view');
const evidenceView = document.querySelector('#evidence-view');
const creator = document.querySelector('#creator');
const form = document.querySelector('#creation-form');
const readerView = document.querySelector('#reader-view');
const draftPDF = document.querySelector('#draft-pdf');
let revision = 0;
let current = null;
let urls = [];
let busy = false;
let draft = null;
let draftURL = null;

function setBusy(value) {
  busy = value;
  choose.disabled = value;
  zone.setAttribute('aria-busy', String(value));
  for (const link of [pdfLink, contextLink, packageLink, draftPDF]) link.setAttribute('aria-disabled', String(value));
  for (const control of form.querySelectorAll('input, textarea, select, button')) control.disabled = value;
}

function remainingStatus() {
  return (draft ? 'Draft for ' + draft.filename + ' remains in this tab.' : current ? current.name + ' remains open.' : 'Choose a PDF or supported .else file.') + ' Nothing uploaded.';
}

function clearDraft() {
  draft = null;
  if (draftURL) URL.revokeObjectURL(draftURL);
  draftURL = null;
  draftPDF.removeAttribute('href');
  form.reset();
  document.querySelector('#draft-text').textContent = '';
  creator.hidden = true;
  readerView.hidden = false;
  for (const number of [1, 2]) updateKind(number);
}

function updateKind(number) {
  const ai = document.querySelector(`#reading-${number}-kind`).value === 'ai';
  document.querySelector(`#reading-${number}-generator-field`).hidden = !ai;
  document.querySelector(`#reading-${number}-generator`).required = ai;
}

async function beginDraft(pdf, filename, token) {
  pdfFilename(filename);
  if (pdf.length < 5 || !pdf.subarray(0, 5).every((byte, index) => byte === [37, 80, 68, 70, 45][index])) throw new Error('This file does not have a PDF header.');
  status.textContent = 'Reading the selectable text in ' + filename + ' on this device…';
  const extraction = await extractPDFText(pdf, () => token === revision);
  if (token !== revision) return;
  clearDraft();
  draft = { pdf, filename, ...extraction };
  draftURL = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  draftPDF.href = draftURL;
  draftPDF.download = filename;
  document.querySelector('#create-title').value = filename.replace(/\.pdf$/i, '');
  document.querySelector('#draft-name').textContent = filename + ' · ' + extraction.pages + ' page(s) · original bytes retained';
  document.querySelector('#draft-text').textContent = extraction.sourceText;
  document.querySelector('#extraction-note').textContent = extraction.extractionNote;
  creator.hidden = false;
  readerView.hidden = true;
  document.body.dataset.readerState = 'draft';
  status.textContent = filename + ' ready. Add source information and two interpretations, then save .else locally. Nothing uploaded.';
  // Focus only after enabling the form at the end of this file operation.
}

function element(tag, words, className) {
  const node = document.createElement(tag);
  node.textContent = words;
  if (className) node.className = className;
  return node;
}

async function render(result, bytes, name, demo) {
  const { model, pdf } = result;
  const nextURLs = [URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' })),
    URL.createObjectURL(new Blob([contextBytes(model)], { type: 'text/markdown;charset=utf-8' })),
    URL.createObjectURL(new Blob([bytes], { type: 'application/x-cyberdelic-else-experiment' }))];
  pdfLink.href = nextURLs[0];
  pdfLink.download = model.filename;
  contextLink.href = nextURLs[1];
  contextLink.download = 'context.md';
  packageLink.href = nextURLs[2];
  packageLink.download = name;
  document.querySelector('#material-title').textContent = model.title;
  document.querySelector('#byte-status').textContent = 'Included bytes checked · unsigned · ' + (demo ? 'public specimen' : 'local file');
  readings.replaceChildren(...model.interpretations.map((reading, index) => {
    const card = document.createElement('article');
    card.append(element('span', `Reading ${index + 1} / ${reading.author.kind} ${reading.author.kind === 'human' ? 'contribution' : 'demonstration'}`, 'eyebrow'),
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
    clearDraft();
    await render(result, bytes, name, demo);
    return token === revision;
  } catch (error) {
    if (token !== revision) return;
    errorMessage.textContent = 'Could not open ' + name + '. ' + error.message;
    errorMessage.hidden = false;
    status.textContent = remainingStatus();
    return false;
  } finally {
    if (token === revision) setBusy(false);
  }
}

async function openFiles(files) {
  const token = ++revision;
  setBusy(false);
  status.textContent = remainingStatus();
  if (files.length !== 1) {
    errorMessage.textContent = 'Choose one PDF or .else file at a time.';
    errorMessage.hidden = false;
    return;
  }
  const file = files[0];
  const isPDF = /\.pdf$/i.test(file.name);
  if ((!isPDF && !/\.else$/i.test(file.name)) || file.size > (isPDF ? MAX_ENTRY : MAX_ARCHIVE)) {
    errorMessage.textContent = 'Choose a PDF up to 12 MiB, or a .else file up to 64 MiB.';
    errorMessage.hidden = false;
    return;
  }
  // Chosen bytes stay in memory. The reader never sends or persists them.
  setBusy(true);
  errorMessage.hidden = true;
  status.textContent = 'Checking ' + file.name + ' on this device…';
  try {
    const bytes = await file.arrayBuffer();
    if (token !== revision) return;
    if (isPDF) await beginDraft(new Uint8Array(bytes), file.name, token);
    else await openBytes(bytes, file.name, false, token);
  } catch (error) {
    if (token !== revision) return;
    errorMessage.textContent = 'Could not read ' + file.name + '. ' + error.message + ' Nothing was uploaded.';
    errorMessage.hidden = false;
    status.textContent = remainingStatus();
  } finally {
    if (token === revision) {
      setBusy(false);
      if (isPDF && draft?.filename === file.name) document.querySelector('#create-title').focus();
    }
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy || !draft || !form.reportValidity()) return;
  const selected = draft;
  const value = (id) => document.querySelector('#' + id).value.trim();
  const interpretations = [1, 2].map((number) => {
    const kind = value(`reading-${number}-kind`);
    return { title: value(`reading-${number}-title`), text: document.querySelector(`#reading-${number}-text`).value,
      author: { kind, name: value(`reading-${number}-name`), role: 'Interpretation ' + number,
        generator: kind === 'ai' ? value(`reading-${number}-generator`) : 'Not applicable (human-written)' } };
  });
  const sourceDescription = value('source-description');
  const source = { kind: 'user-declared', creator: value('source-creator'),
    description: sourceDescription + '\n\nPDF text extraction: ' + selected.extractionNote };
  const token = ++revision;
  const title = value('create-title');
  setBusy(true);
  errorMessage.hidden = true;
  status.textContent = 'Creating your .else on this device…';
  try {
    if (!title) throw new Error('Add a title for the material.');
    if (!sourceDescription) throw new Error('Add where the PDF came from.');
    if (!source.creator) throw new Error('Add the original creator, or enter Unknown.');
    for (const [index, reading] of interpretations.entries()) {
      if (!reading.title.trim() || !reading.text.trim() || !reading.author.name.trim()) throw new Error('Add a title, contributor name and text for interpretation ' + (index + 1) + '.');
      if (reading.author.kind === 'ai' && !reading.author.generator.trim()) throw new Error('Name the AI tool or model for interpretation ' + (index + 1) + '.');
    }
    const bytes = await writePackage({ pdf: selected.pdf, filename: selected.filename, title,
      source, sourceText: selected.sourceText, interpretations });
    if (token !== revision) return;
    const name = selected.filename.replace(/\.pdf$/i, '.else');
    if (await openBytes(bytes, name, false, token) && token === revision) {
      packageLink.click();
      status.textContent = name + ' created on this device. Download started. You can save the .else, original PDF or AI context below. Nothing uploaded.';
    }
  } catch (error) {
    if (token !== revision) return;
    errorMessage.textContent = 'Could not create the .else. ' + error.message + ' Your draft is still here.';
    errorMessage.hidden = false;
    status.textContent = remainingStatus();
  } finally {
    if (token === revision) setBusy(false);
  }
});
for (const number of [1, 2]) document.querySelector(`#reading-${number}-kind`).addEventListener('change', () => updateKind(number));
document.querySelector('#cancel-creation').addEventListener('click', () => {
  revision++;
  clearDraft();
  setBusy(false);
  errorMessage.hidden = true;
  document.body.dataset.readerState = current?.demo ? 'specimen' : 'local';
  status.textContent = remainingStatus();
  choose.focus();
});

choose.disabled = false;
choose.addEventListener('click', () => input.click());
input.addEventListener('change', () => {
  const files = Array.from(input.files);
  input.value = '';
  void openFiles(files);
});
for (const link of [pdfLink, contextLink, packageLink, draftPDF]) {
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
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) for (const url of [...urls, ...(draftURL ? [draftURL] : [])]) URL.revokeObjectURL(url);
});

const specimen = document.querySelector('#initial-package').content.textContent.trim();
const bytes = Uint8Array.from(atob(specimen), (character) => character.charCodeAt(0));
await openBytes(bytes, 'One-file-two-readings.else', true);
