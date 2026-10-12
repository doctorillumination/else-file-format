import { MAX_ARCHIVE, MAX_ENTRY, readPackage, aiContext, contextBytes, digest } from './format.mjs';
import { previewPDF, extractPDFText, clearPDF } from './preview.mjs';
import { pdfFilename, writePackage, revisionDescription } from './create.mjs';

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
const draftPackage = document.querySelector('#draft-package');
const sampleButton = document.querySelector('#try-sample');
const editButton = document.querySelector('#edit-file');
const copyButton = document.querySelector('#copy-context');
const closeButton = document.querySelector('#close-file');
let revision = 0;
let current = null;
let urls = [];
let busy = false;
let draft = null;
let draftURL = null;
let dirty = false;

function setBusy(value) {
  busy = value;
  choose.disabled = value;
  sampleButton.disabled = value;
  editButton.disabled = value;
  copyButton.disabled = value;
  zone.setAttribute('aria-busy', String(value));
  for (const link of [pdfLink, contextLink, packageLink, draftPDF, draftPackage]) link.setAttribute('aria-disabled', String(value));
  for (const control of form.querySelectorAll('input, textarea, select, button')) control.disabled = value;
}

function remainingStatus() {
  return (draft ? 'Draft for ' + draft.filename + ' remains in this tab.' : current ? current.name + ' remains open.' : 'Choose a PDF or supported .else file.') + ' Nothing uploaded.';
}

function clearDraft() {
  draft = null;
  dirty = false;
  if (draftURL) URL.revokeObjectURL(draftURL);
  draftURL = null;
  draftPDF.removeAttribute('href');
  draftPackage.removeAttribute('href');
  draftPackage.hidden = true;
  document.querySelector('#draft-origin').hidden = true;
  document.querySelector('#draft-origin').textContent = '';
  document.querySelector('#unsaved-status').hidden = true;
  form.reset();
  document.querySelector('#draft-text').textContent = '';
  document.querySelector('#draft-name').textContent = '';
  document.querySelector('#extraction-note').textContent = '';
  creator.hidden = true;
  readerView.hidden = !current;
  closeButton.hidden = !current;
  for (const number of [1, 2]) updateKind(number);
}

function mayReplaceDraft() {
  return !draft || !dirty || window.confirm('Discard these unsaved changes? Save a .else copy first if you want to keep them.');
}

function showDraft() {
  draftURL = URL.createObjectURL(new Blob([draft.pdf], { type: 'application/pdf' }));
  draftPDF.href = draftURL;
  draftPDF.download = draft.filename;
  const editing = draft.mode === 'edit';
  document.querySelector('#create-heading').textContent = editing ? 'Edit the context.' : 'Make room for context.';
  document.querySelector('#save-created').textContent = editing ? 'Save edited .else' : 'Save .else locally';
  document.querySelector('#draft-text').textContent = draft.sourceText;
  document.querySelector('#extraction-note').textContent = draft.extractionNote;
  creator.hidden = false;
  readerView.hidden = true;
  closeButton.hidden = false;
  document.body.dataset.readerState = editing ? 'editing' : 'draft';
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
  if (!mayReplaceDraft()) { status.textContent = remainingStatus(); return; }
  clearDraft();
  draft = { mode: 'create', pdf, filename, ...extraction };
  document.querySelector('#create-title').value = filename.replace(/\.pdf$/i, '');
  document.querySelector('#draft-name').textContent = filename + ' · ' + extraction.pages + ' page(s) · original bytes retained';
  showDraft();
  status.textContent = filename + ' ready. Add source information and two interpretations, then save .else locally. Nothing uploaded.';
  // Focus only after enabling the form at the end of this file operation.
}

async function editCurrent() {
  if (busy || !current) return;
  const token = ++revision;
  const selected = current;
  setBusy(true);
  errorMessage.hidden = true;
  try {
    const baseHash = await digest(selected.bytes);
    if (token !== revision) return;
    clearDraft();
    const { model, pdf } = selected.result;
    draft = { mode: 'edit', pdf, filename: model.filename, sourceText: model.sourceText,
      extractionNote: 'Preserved from the opened .else. The PDF and its text derivative are kept unchanged.',
      sourceKind: model.source.kind, authors: model.interpretations.map((reading) => ({ ...reading.author })),
      baseHash, baseName: selected.name };
    document.querySelector('#create-title').value = model.title;
    document.querySelector('#source-creator').value = model.source.creator;
    document.querySelector('#source-description').value = model.source.description;
    for (const [index, reading] of model.interpretations.entries()) {
      const number = index + 1;
      for (const [suffix, value] of Object.entries({ title: reading.title, name: reading.author.name,
        role: reading.author.role, kind: reading.author.kind, generator: reading.author.kind === 'ai' ? reading.author.generator : '', text: reading.text })) {
        document.querySelector(`#reading-${number}-${suffix}`).value = value;
      }
      updateKind(number);
    }
    document.querySelector('#draft-name').textContent = selected.name + ' · original PDF retained';
    showDraft();
    draftPackage.href = packageLink.href;
    draftPackage.download = selected.name;
    draftPackage.hidden = false;
    document.querySelector('#draft-origin').textContent = 'Save creates a new copy. Original .else fingerprint: ' + baseHash + '. A revision reference will travel in the source information.';
    document.querySelector('#draft-origin').hidden = false;
    status.textContent = selected.name + ' open for editing. Save an edited copy to keep your changes. Nothing uploaded.';
  } catch (error) {
    if (token !== revision) return;
    errorMessage.textContent = 'Could not prepare editing. ' + error.message;
    errorMessage.hidden = false;
  } finally {
    if (token === revision) { setBusy(false); document.querySelector('#create-title').focus(); }
  }
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
      element('h3', reading.title), element('p', reading.text),
      element('small', reading.author.name + ' · ' + reading.author.role));
    return card;
  }));
  contextView.textContent = aiContext(model);
  evidenceView.textContent = JSON.stringify(model, null, 2);
  document.querySelector('#source-view').textContent = model.sourceText;
  document.querySelector('#source-creator-view').textContent = model.source.creator;
  document.querySelector('#source-description-view').textContent = model.source.description;
  current = { name, demo, result, bytes };
  readerView.hidden = false;
  closeButton.hidden = false;
  status.textContent = (demo ? 'Public specimen open. ' : name + ' open on this device. ') + 'Original bytes checked. Nothing uploaded.';
  document.body.dataset.readerState = demo ? 'specimen' : 'local';
  for (const url of urls) URL.revokeObjectURL(url);
  urls = nextURLs;
  await previewPDF(pdf);
}

async function openBytes(bytes, name, demo = false, token = ++revision, saving = false) {
  if (token !== revision) return;
  setBusy(true);
  errorMessage.hidden = true;
  status.textContent = 'Checking ' + name + ' on this device…';
  try {
    const result = await readPackage(bytes);
    if (token !== revision) return;
    if (!saving && !mayReplaceDraft()) { status.textContent = remainingStatus(); return false; }
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
  const value = (id) => document.querySelector('#' + id).value;
  const interpretations = [1, 2].map((number) => {
    const kind = value(`reading-${number}-kind`);
    return { title: value(`reading-${number}-title`), text: document.querySelector(`#reading-${number}-text`).value,
      author: { kind, name: value(`reading-${number}-name`), role: value(`reading-${number}-role`),
        generator: kind === 'ai' ? value(`reading-${number}-generator`) :
          selected.mode === 'edit' && selected.authors[number - 1].kind === 'human' ? selected.authors[number - 1].generator : 'Not applicable (human-written)' } };
  });
  const sourceDescription = value('source-description');
  const editing = selected.mode === 'edit';
  const source = { kind: editing ? selected.sourceKind : 'user-declared', creator: value('source-creator'),
    description: editing ? revisionDescription(sourceDescription, selected.baseName, selected.baseHash) : sourceDescription + '\n\nPDF text extraction: ' + selected.extractionNote };
  const token = ++revision;
  const title = value('create-title');
  setBusy(true);
  errorMessage.hidden = true;
  status.textContent = 'Creating your .else on this device…';
  try {
    if (!title.trim()) throw new Error('Add a title for the material.');
    if (!sourceDescription.trim()) throw new Error('Add where the PDF came from.');
    if (!source.creator.trim()) throw new Error('Add the original creator, or enter Unknown.');
    for (const [index, reading] of interpretations.entries()) {
      if (!reading.title.trim() || !reading.text.trim() || !reading.author.name.trim() || !reading.author.role.trim()) throw new Error('Add a title, contributor name, role and text for interpretation ' + (index + 1) + '.');
      if (reading.author.kind === 'ai' && !reading.author.generator.trim()) throw new Error('Name the AI tool or model for interpretation ' + (index + 1) + '.');
    }
    const bytes = await writePackage({ pdf: selected.pdf, filename: selected.filename, title,
      source, sourceText: selected.sourceText, interpretations });
    if (token !== revision) return;
    const name = editing ? selected.baseName.replace(/\.else$/i, '') + '-edited.else' : selected.filename.replace(/\.pdf$/i, '.else');
    if (await openBytes(bytes, name, false, token, true) && token === revision) {
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
for (const event of ['input', 'change']) form.addEventListener(event, () => {
  if (!draft) return;
  dirty = true;
  document.querySelector('#unsaved-status').hidden = false;
});
window.addEventListener('beforeunload', (event) => {
  if (draft && dirty) { event.preventDefault(); event.returnValue = ''; }
});
for (const number of [1, 2]) document.querySelector(`#reading-${number}-kind`).addEventListener('change', () => updateKind(number));
document.querySelector('#cancel-creation').addEventListener('click', () => {
  revision++;
  clearDraft();
  setBusy(false);
  errorMessage.hidden = true;
  document.body.dataset.readerState = current ? (current.demo ? 'specimen' : 'local') : 'empty';
  status.textContent = remainingStatus();
  choose.focus();
});
editButton.addEventListener('click', () => void editCurrent());
copyButton.addEventListener('click', async () => {
  if (busy || !current) return;
  try {
    await navigator.clipboard.writeText(aiContext(current.result.model));
    status.textContent = 'AI-readable context copied. No file was uploaded.';
  } catch {
    status.textContent = 'Clipboard access is unavailable. Choose Save AI context instead.';
  }
});
closeButton.addEventListener('click', async () => {
  if (!mayReplaceDraft()) return;
  revision++;
  clearDraft();
  current = null;
  readerView.hidden = true;
  closeButton.hidden = true;
  for (const url of urls) URL.revokeObjectURL(url);
  urls = [];
  for (const id of ['material-title', 'source-view', 'source-creator-view', 'source-description-view', 'readings', 'context-view', 'evidence-view']) document.querySelector('#' + id).replaceChildren();
  document.body.dataset.readerState = 'empty';
  setBusy(false);
  errorMessage.hidden = true;
  status.textContent = 'File closed. Your files stay on your computer. Choose another or try a sample.';
  await clearPDF();
});

choose.disabled = false;
choose.addEventListener('click', () => input.click());
input.addEventListener('change', () => {
  const files = Array.from(input.files);
  input.value = '';
  void openFiles(files);
});
for (const link of [pdfLink, contextLink, packageLink, draftPDF, draftPackage]) {
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
sampleButton.addEventListener('click', () => void openBytes(bytes, 'One-file-two-readings.else', true));
setBusy(false);
