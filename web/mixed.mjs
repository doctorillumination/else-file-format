import { readMixed, include, newEdition, mixedContext, base64, need } from './mixed-format.mjs';
import { extractPDFText } from './preview.mjs';
import { readingView } from './mixed-reading.mjs';
import { sample } from './mixed-sample.mjs';

let model = null, head = null, dirty = false, unsaved = false, busy = false, selectedPDF = null, selectedVoice = null, urls = [], revision = 0;
let disposeReading = () => {};
const enc = new TextEncoder();
const desktop = window.elseDesktop;
const $ = id => document.getElementById('mixed-' + id);
function el(tag, text, cls) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; }
function status(text, error = false) { $('status').textContent = text; $('status').className = error ? 'error' : 'muted'; }
function field(id, label, type = 'text') { const l = el('label', label); l.htmlFor = 'mixed-' + id; const i = el(type === 'textarea' ? 'textarea' : 'input'); i.id = 'mixed-' + id; if (type !== 'textarea') i.type = type; return [l, i]; }
function button(text, fn, cls = 'secondary') { const b = el('button', text, cls); b.type = 'button'; b.onclick = () => run(fn); return b; }
async function run(fn) { if (busy) return; busy = true; try { await fn(); } catch (e) { status(e.message, true); } finally { busy = false; } }
function blobURL(data, mime) { const u = URL.createObjectURL(new Blob([data], { type: mime })); urls.push(u); return u; }
function clearURLs() { disposeReading(); disposeReading = () => {}; urls.forEach(URL.revokeObjectURL); urls = []; }
async function mayReplace() { if (!dirty && !unsaved) return true; return desktop ? desktop.confirmDiscard() : confirm('Discard unsaved changes? Save a .else copy to keep them.'); }
async function save(bytes, name, kind) {
  if (desktop) return (await desktop.saveFile({ bytes, name, kind })).saved;
  const a = el('a'); a.href = blobURL(bytes, kind === 'else' ? 'application/vnd.cyberdelic.else+zip' : kind === 'pdf' ? 'application/pdf' : 'application/octet-stream'); a.download = name; a.click(); return true;
}
function loadField(id, v) { $(id).value = v || ''; }
function current() { return model.editions[head]; }
function hideLegacy() { if ($('app')) return; for (const child of [...document.body.children]) if (!['SCRIPT', 'TEMPLATE'].includes(child.tagName)) child.hidden = true; }
export async function launchMixed(bytes = null, filename = 'Mixed.else') {
  let next = bytes ? await readMixed(bytes) : null;
  if ($('app') && !await mayReplace()) return;
  hideLegacy(); mount();
  if (next) { model = next; head = next.manifest.heads[0]; dirty = false; unsaved = false; render(); status(filename + ' opened locally.'); }
  else { model = null; head = null; delete window.mixedReader; dirty = false; unsaved = false; editor(); }
}
function mount() {
  if ($('app')) return;
  const root = el('main'); root.id = 'mixed-app';
  root.append(el('p', 'Cyberdelic OS / .else', 'eyebrow'), el('h1', 'Material, with room for voices.'));
  root.append(el('p', 'Bring a PDF, a post, a passage and a voice together. Your selected files stay on this device.'));
  const actions = el('div', undefined, 'actions');
  const picker = el('input'); picker.type = 'file'; picker.accept = '.else'; picker.id = 'mixed-open-input'; picker.hidden = true;
  picker.onchange = () => run(async () => { if (picker.files[0]) await openFile(picker.files[0]); picker.value = ''; });
  actions.append(button('Example', () => launchMixed(Uint8Array.from(atob(sample), c => c.charCodeAt(0)), 'Public reading example')), button('Open .else', async () => { if (desktop) { const f = await desktop.chooseFile(); if (f) await launchMixed(f.bytes, f.name); } else picker.click(); }), button('New composition', async () => { if (await mayReplace()) { model = null; head = null; delete window.mixedReader; selectedPDF = null; selectedVoice = null; dirty = false; unsaved = false; editor(); } }), button('Close file', async () => { if (!await mayReplace()) return; clearURLs(); model = null; delete window.mixedReader; dirty = false; unsaved = false; root.remove(); for (const child of [...document.body.children]) child.hidden = false; if (!document.querySelector('#drop-zone')) location.reload(); }));
  root.append(actions, picker);
  const drop = el('div', 'Drop a .else to open it, or a PDF and a voice recording to begin.', 'drop'); drop.id = 'mixed-drop';
  drop.ondragover = e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; };
  drop.ondrop = e => { e.preventDefault(); void run(async () => { const files = [...e.dataTransfer.files]; if (files.length === 1 && /\.else$/i.test(files[0].name)) await openFile(files[0]); else { if (!await mayReplace()) return; const pdf = files.find(f => /\.pdf$/i.test(f.name)), voice = files.find(f => /\.(wav|m4a|mp3|ogg|webm)$/i.test(f.name)); need(pdf && files.length <= 2 && files.every(f => f === pdf || f === voice), 'Drop one PDF and optionally one voice recording.'); model = null; head = null; dirty = true; unsaved = false; editor(); selectedPDF = pdf; selectedVoice = voice || null; status('Selected ' + files.map(f => f.name).join(' and ') + '. Add source information below.'); } }); };
  root.append(drop);
  const s = el('p', 'Files stay local. Live sources load automatically when online.', 'muted'); s.id = 'mixed-status'; s.setAttribute('role', 'status'); root.append(s);
  const content = el('div'); content.id = 'mixed-content'; root.append(content); document.body.append(root);
  window.addEventListener('beforeunload', e => { if (dirty || unsaved) { e.preventDefault(); e.returnValue = ''; } });
  document.body.dataset.mixedState = 'ready';
  document.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', e => { if (e.dataTransfer.files.length && !e.target.closest('#mixed-drop')) drop.ondrop(e); });
  if (desktop) { desktop.onFile(f => void run(() => launchMixed(f.bytes, f.name))); desktop.onAction(a => { if (document.getElementById('mixed-app')) { if (a === 'save') void run(() => $('form') ? publish() : exportPackage()); if (a === 'edit' && model) editor(); } }); }
}
async function openFile(file) { need(file.size <= 64 * 1024 * 1024, 'Choose a .else up to 64 MiB.'); await launchMixed(new Uint8Array(await file.arrayBuffer()), file.name); }
function editor() {
  clearURLs(); $('app').classList.remove('is-reading'); $('content').replaceChildren(); selectedPDF = null; selectedVoice = null;
  const form = el('form'); form.id = 'mixed-form'; form.onsubmit = e => { e.preventDefault(); void run(publish); }; form.oninput = () => { dirty = true; };
  form.append(...field('title', 'Composition title'), ...field('editor', 'Your contributor name'));
  $('content').append(form);
  if (model) {
    loadField('title', current().title); loadField('editor', '');
    form.append(el('p', 'This edition keeps its source material and earlier contributions intact. Add a response below.'));
  } else {
    for (const [legend, fields] of [['Original PDF', [['pdf', 'Choose PDF', 'file'], ['pdf-title', 'PDF title'], ['pdf-creator', 'Original creator / source']]], ['Social reference', [['social-url', 'X or Instagram HTTPS link', 'url'], ['social-title', 'Post title'], ['social-creator', 'Original account / creator'], ['social-excerpt', 'Saved excerpt you supply (optional)', 'textarea']]], ['YouTube passage', [['youtube-url', 'YouTube link', 'url'], ['youtube-title', 'Video title'], ['youtube-creator', 'Original channel / creator'], ['start', 'Start in seconds', 'number'], ['end', 'End in seconds', 'number'], ['youtube-excerpt', 'Passage text you supply (optional)', 'textarea']]]]) {
      const fs = el('fieldset'); fs.append(el('legend', legend)); for (const f of fields) fs.append(...field(...f)); form.append(fs);
    }
    $('pdf').accept = '.pdf'; $('pdf').onchange = () => { selectedPDF = $('pdf').files[0]; dirty = true; };
    for (const id of ['pdf-title', 'pdf-creator', 'social-url', 'social-title', 'social-creator', 'youtube-url', 'youtube-title', 'youtube-creator', 'start', 'end']) $(id).required = true;
    $('start').min = 0; $('end').min = 1; loadField('start', '0'); loadField('end', '60');
  }
  const context = el('fieldset'); context.append(el('legend', model ? 'New response' : 'Written or spoken context'));
  const targetLabel = el('label', 'Context target'); targetLabel.htmlFor = 'mixed-target'; const target = el('select'); target.id = 'mixed-target';
  const options = [['', 'Whole composition'], ...(model ? current().materials.map(id => [id, model.materials[id].title]) : [['pdf', 'PDF'], ['social', 'Social post'], ['youtube', 'YouTube passage']])];
  for (const [value, title] of options) { const option = el('option', title); option.value = value; target.append(option); } context.append(targetLabel, target);
  context.append(...field('contributor', 'Contributor name'));
  const label = el('label', 'Contribution type'); label.htmlFor = 'mixed-author-kind'; const kind = el('select'); kind.id = 'mixed-author-kind'; for (const [value, text] of [['human', 'Human'], ['ai', 'AI proposal']]) { const o = el('option', text); o.value = value; kind.append(o); }
  context.append(label, kind, ...field('generator', 'AI tool / model (required for AI)'), ...field('note', 'Your interpretation / response', 'textarea'), ...field('voice', 'Voice recording (optional)', 'file'), ...field('transcript', 'Voice transcript you supply (optional)', 'textarea'));
  $('voice')?.setAttribute('accept', '.wav,.m4a,.mp3,.ogg,.webm'); form.append(context);
  $('voice').accept = '.wav,.m4a,.mp3,.ogg,.webm'; $('voice').onchange = () => { selectedVoice = $('voice').files[0]; dirty = true; };
  form.append(button('Save .else copy', publish, ''), button('Cancel', async () => { if (await mayReplace()) { dirty = false; model ? render() : editor(); } }));
  $('title').required = true; $('editor').required = true; $('contributor').required = true;
  document.body.dataset.mixedState = 'editing'; status('Sources and context are reviewed before saving. Reloading clears unsaved work.');
}
function canonicalYouTube(value) {
  const u = new URL(value); let id;
  if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
  else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(u.hostname)) id = u.searchParams.get('v') || /^\/(?:shorts|embed|live)\/([\w-]{11})$/.exec(u.pathname)?.[1];
  need((id || '').length === 11 && /^[\w-]{11}$/.test(id || ''), 'Choose a recognized YouTube link.'); return 'https://www.youtube.com/watch?v=' + id;
}
async function publish() {
  need($('form').reportValidity(), 'Complete the required source and contributor fields.');
  const previous = model, files = new Map(model?.files || []), materials = model ? [...current().materials] : [], contexts = model ? [...current().contexts] : [];
  const text = async s => s.trim() ? include(files, 'blobs', enc.encode(s)) : null;
  if (!model) {
    need(selectedPDF && selectedPDF.size <= 12 * 1024 * 1024, 'Choose a PDF up to 12 MiB.');
    const pdf = new Uint8Array(await selectedPDF.arrayBuffer()); const extraction = await extractPDFText(pdf);
    const extracted = extraction.sourceText;
    materials.push(await include(files, 'materials', { kind: 'pdf', title: $('pdf-title').value, creator: $('pdf-creator').value, url: null, filename: selectedPDF.name, mime: 'application/pdf', blob: await include(files, 'blobs', pdf), excerpt: await text(extracted || '[Selectable PDF text unavailable]'), method: 'PDF.js local selectable-text extraction; no OCR', start: null, end: null }));
    materials.push(await include(files, 'materials', { kind: 'social', title: $('social-title').value, creator: $('social-creator').value, url: $('social-url').value, filename: null, mime: null, blob: null, excerpt: await text($('social-excerpt').value), method: $('social-excerpt').value.trim() ? 'User-supplied excerpt; source accuracy unverified' : null, start: null, end: null }));
    materials.push(await include(files, 'materials', { kind: 'youtube', title: $('youtube-title').value, creator: $('youtube-creator').value, url: canonicalYouTube($('youtube-url').value), filename: null, mime: null, blob: null, excerpt: await text($('youtube-excerpt').value), method: $('youtube-excerpt').value.trim() ? 'User-supplied passage text; source accuracy unverified' : null, start: Number($('start').value), end: Number($('end').value) }));
  }
  const kind = $('author-kind').value, note = await text($('note').value); let audio = null, mime = null;
  if (selectedVoice) {
    need(selectedVoice.size <= 12 * 1024 * 1024 && selectedVoice.size > 0, 'Choose audio up to 12 MiB.');
    mime = { wav: 'audio/wav', m4a: 'audio/mp4', mp3: 'audio/mpeg', ogg: 'audio/ogg', webm: 'audio/webm' }[selectedVoice.name.split('.').pop().toLowerCase()]; need(mime, 'Unsupported voice recording.');
    const data = new Uint8Array(await selectedVoice.arrayBuffer());
    const probe = new Audio(blobURL(data, mime)); const duration = await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(Error('This reader cannot decode that voice recording. Use PCM WAV.')), 8000); probe.onloadedmetadata = () => { clearTimeout(timeout); resolve(probe.duration); }; probe.onerror = () => { clearTimeout(timeout); reject(Error('This reader cannot decode that recording. Use PCM WAV.')); }; });
    need(Number.isFinite(duration) && duration <= 120, 'Keep the voice recording within two minutes.'); audio = await include(files, 'blobs', data);
  }
  need(note || audio, 'Add written or spoken context.');
  const transcript = audio ? await text($('transcript').value) : null;
  const target = $('target').value, targetMaterial = target ? (previous ? target : materials[['pdf', 'social', 'youtube'].indexOf(target)]) : null;
  const cid = await include(files, 'contexts', { author: { kind, name: $('contributor').value, generator: kind === 'ai' ? $('generator').value : null }, material: targetMaterial, base: head, text: note, audio, filename: audio ? selectedVoice.name : null, mime, transcript, transcriptMethod: transcript ? 'User-supplied transcript; not independently checked against recording' : null, status: kind === 'ai' ? 'proposal' : 'declared' });
  contexts.push(cid);
  const draftModel = previous ? { ...previous, files } : { files, manifest: { heads: [], proofs: [] } };
  // New objects use an independent UUID; edited copies retain their original identity and all ancestors.
  const bytes = await newEdition(previous ? draftModel : null, { title: $('title').value, editor: $('editor').value, materials, contexts, parents: previous ? [head] : [], files });
  const next = await readMixed(bytes); model = next; head = next.manifest.heads[0]; dirty = false; unsaved = true; render();
  const saved = await save(bytes, 'Mixed-material.else', 'else'); unsaved = !saved; status(saved ? 'Saved locally. Source files and earlier contributions stay intact.' : 'Save cancelled. Your new edition is still unsaved.');
}
async function exportPackage() { if (model) { const saved = await save(model.bytes, 'Mixed-material.else', 'else'); if (saved) unsaved = false; status(saved ? 'Saved locally.' : 'Save cancelled. Your file remains open.'); } }
function sourceViewer(a) {
  const u = new URL(a.url), kind = a.kind === 'youtube' ? 'youtube' : /^(?:www\.)?(?:x|twitter)\.com$/.test(u.hostname) && /^\/[^/]+\/status\/\d+$/.test(u.pathname) ? 'x' : 'reference';
  if (desktop) { need(desktop.viewSource, 'Rebuild this desktop app to enable source viewing.'); return desktop.viewSource({ kind, url: a.url, start: a.start, end: a.end }); }
  const target = new URL('source-viewer.html', location.href); target.hash = new URLSearchParams({ kind, url: a.url, start: a.start ?? 0, end: a.end ?? 0 }); window.open(target.href, '_blank', 'noopener,noreferrer');
}
function sourceControl(a) {
  const title = a.kind === 'youtube' ? 'Play passage online' : 'View source online';
  if (desktop) return button(title, () => sourceViewer(a));
  const u = new URL(a.url), kind = a.kind === 'youtube' ? 'youtube' : /^(?:www\.)?(?:x|twitter)\.com$/.test(u.hostname) && /^\/[^/]+\/status\/\d+$/.test(u.pathname) ? 'x' : 'reference';
  const destination = new URL('source-viewer.html', location.href); destination.hash = new URLSearchParams({ kind, url: a.url, start: a.start ?? 0, end: a.end ?? 0 });
  const link = el('a', title, 'button'); link.href = destination.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link;
}
function render() {
  clearURLs(); $('content').replaceChildren(); $('app').classList.add('is-reading'); document.body.dataset.mixedState = 'reading';
  disposeReading = readingView({ model, head, root: $('content'), save, blobURL, status, desktop, sourceControl,
    edit: async () => { if (await mayReplace()) editor(); }, exportPackage,
    selectEdition: value => { head = value; render(); } });
  window.mixedReader = { model, head, exportPackage };
}
if (/\/mixed(?:\.html)?\/?$/.test(location.pathname)) { await launchMixed(location.hash === '#example' ? Uint8Array.from(atob(sample), c => c.charCodeAt(0)) : null, 'Public reading example'); if (desktop) { const pending = await desktop.pendingFile(); if (pending) await launchMixed(pending.bytes, pending.name); } }
