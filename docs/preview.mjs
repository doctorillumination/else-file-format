import { getDocument, GlobalWorkerOptions, PDFWorker, AnnotationMode } from './vendor/pdf.mjs';

GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
const worker = new PDFWorker({ name: 'else-local-preview' });
const canvas = document.querySelector('#pdf-canvas');
const label = document.querySelector('#pdf-page');
const previous = document.querySelector('#pdf-previous');
const next = document.querySelector('#pdf-next');
let documentTask = null;
let pdfDocument = null;
let renderTask = null;
let revision = 0;
let pageNumber = 1;
let drawing = false;

function localDocument(pdf) {
  return getDocument({ data: pdf.slice(), worker, isEvalSupported: false,
    useWasm: false, useWorkerFetch: false, useSystemFonts: true,
    disableAutoFetch: true, disableStream: true, maxImageSize: 4 * 1024 * 1024,
    canvasMaxAreaInBytes: 16 * 1024 * 1024, verbosity: 0 });
}

export async function extractPDFText(pdf, isCurrent = () => true) {
  await worker.promise;
  const task = localDocument(pdf);
  task.onPassword = () => { void task.destroy(); };
  try {
    const document = await task.promise;
    if (document.numPages > 200) throw new Error('This experiment supports PDF text extraction for up to 200 pages.');
    const pages = [];
    let characters = 0;
    for (let number = 1; number <= document.numPages; number++) {
      if (!isCurrent()) throw new Error('A newer file was selected.');
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const words = content.items.filter((item) => typeof item.str === 'string')
        .map((item) => item.str + (item.hasEOL ? '\n' : ' ')).join('').trim();
      characters += Array.from(words).length + 2;
      if (characters > 65536) throw new Error('The selectable PDF text exceeds this experiment\'s 65,536-character limit. Try a shorter PDF.');
      pages.push(words);
      page.cleanup();
    }
    const sourceText = pages.join('\n\n').trim();
    return { sourceText: sourceText || 'No selectable text was found in the PDF. No OCR or transcription was performed.',
      extractionNote: sourceText ? 'Selectable text extracted locally with PDF.js. No OCR or summarization was performed.' : 'Text extraction unavailable: no selectable text was found. No OCR or transcription was performed.',
      pages: document.numPages };
  } catch (error) {
    if (error.name === 'PasswordException' || error.message?.includes('Worker was destroyed')) {
      throw new Error('Password-protected PDFs are not supported in this experiment. Use an unlocked copy.');
    }
    throw error;
  } finally {
    await task.destroy();
  }
}

function buttons() {
  previous.disabled = drawing || !pdfDocument || pageNumber <= 1;
  next.disabled = drawing || !pdfDocument || pageNumber >= pdfDocument.numPages;
}

export async function clearPDF() {
  revision++;
  renderTask?.cancel();
  const previousTask = documentTask;
  documentTask = null;
  pdfDocument = null;
  drawing = false;
  canvas.hidden = true;
  canvas.width = 0;
  canvas.height = 0;
  label.textContent = '';
  document.body.dataset.previewState = 'empty';
  buttons();
  if (previousTask) await previousTask.destroy();
}

async function draw(token) {
  drawing = true;
  buttons();
  try {
    const page = await pdfDocument.getPage(pageNumber);
    if (token !== revision) return;
    const base = page.getViewport({ scale: 1 });
    if (!Number.isFinite(base.width) || !Number.isFinite(base.height) || base.width <= 0 || base.height <= 0) throw new Error('Invalid page dimensions.');
    const scale = Math.min(1600 / base.width, 2000 / base.height, 2);
    const viewport = page.getViewport({ scale });
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    renderTask = page.render({ canvas, viewport, annotationMode: AnnotationMode.DISABLE });
    await renderTask.promise;
    if (token !== revision) return;
    canvas.hidden = false;
    canvas.setAttribute('aria-label', 'Original PDF, page ' + pageNumber + ' of ' + pdfDocument.numPages);
    label.textContent = 'Page ' + pageNumber + ' of ' + pdfDocument.numPages;
    document.body.dataset.previewState = 'ready';
  } finally {
    if (token === revision) { drawing = false; buttons(); }
  }
}

export async function previewPDF(pdf) {
  const token = ++revision;
  renderTask?.cancel();
  canvas.hidden = true;
  label.textContent = 'Preparing the local PDF preview…';
  document.body.dataset.previewState = 'loading';
  pdfDocument = null;
  buttons();
  try {
    if (documentTask) await documentTask.destroy();
    if (token !== revision) return;
    await worker.promise;
    if (token !== revision) return;
    documentTask = localDocument(pdf);
    documentTask.onPassword = () => { void documentTask.destroy(); };
    const document = await documentTask.promise;
    if (token !== revision) return;
    pdfDocument = document;
    pageNumber = 1;
    await draw(token);
  } catch {
    if (token !== revision) return;
    label.textContent = 'Preview unavailable. Save the original PDF to open it in your usual reader.';
    document.body.dataset.previewState = 'unavailable';
    canvas.hidden = true;
    pdfDocument = null;
    buttons();
  }
}

async function turn(delta) {
  if (drawing || !pdfDocument) return;
  pageNumber = Math.max(1, Math.min(pdfDocument.numPages, pageNumber + delta));
  const token = revision;
  try { await draw(token); }
  catch {
    if (token === revision) label.textContent = 'This page could not be previewed. The original PDF is still available to save.';
  }
}
previous.addEventListener('click', () => void turn(-1));
next.addEventListener('click', () => void turn(1));
