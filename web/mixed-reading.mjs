import { getDocument, AnnotationMode } from './vendor/pdf.mjs';
import { worker } from './preview.mjs';
import { mixedContext } from './mixed-format.mjs';

const icons = {
  pdf: '<path d="M6 3h8l4 4v14H6V3Z"/><path d="M14 3v5h4M9 12h6m-6 4h4"/>',
  post: '<path d="M4 3h4l12 18h-4L4 3ZM20 3 4 21"/>',
  video: '<rect x="2" y="5" width="20" height="14" rx="4"/><path d="m10 9 6 3-6 3V9Z"/>',
  voice: '<rect x="9" y="2" width="6" height="13" rx="3"/><path d="M6 10v2a6 6 0 0 0 12 0v-2M12 18v4m-3 0h6"/>',
  expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  play: '<path d="m8 5 11 7-11 7V5Z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
  check: '<path d="m5 12 4 4L19 6"/>', note: '<path d="M5 3h14v18H5V3Zm4 5h6m-6 4h6m-6 4h4"/>'
};
function el(tag, text, cls) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; }
function icon(name) { const n = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); n.setAttribute('viewBox', '0 0 24 24'); n.setAttribute('aria-hidden', 'true'); n.innerHTML = icons[name] || icons.note; return n; }
function time(seconds) { const n = Math.max(0, Math.floor(seconds || 0)); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); }

// Only public source identifiers enter the remote frames. Archive bytes and notes remain here.
export function readingView({ model, head, root, save, blobURL, status, edit, exportPackage, selectEdition, sourceControl, desktop }) {
  const edition = model.editions[head], cleanups = [], tasks = [], frames = [], audios = [], playingFrames = new Set(), videoNonces = new Map();
  let disposed = false, fullVideo = null, oldInert = [], videoFocus = null, pdfTask = null, pdfDoc = null, pdfMaterial = null, page = 1, pageBusy = false;
  const act = fn => Promise.resolve().then(fn).catch(e => { if (!disposed) status(e.message, true); });
  const button = (text, fn, cls = 'quiet-button') => { const n = el('button', text, cls); n.type = 'button'; n.onclick = () => act(fn); return n; };
  const link = (text, url) => { const n = el('a', text); n.href = url; n.rel = 'noopener noreferrer'; n.target = '_blank'; return n; };
  const proofStatus = model.proofs.some(p => p.verified && p.edition === head) ? 'This edition signed' : model.proofs.some(p => p.verified) ? 'Earlier edition signed' : 'Unsigned edition';
  const intro = el('header', undefined, 'reading-intro'), feed = el('div', undefined, 'reading-feed');
  intro.append(el('h2', edition.title));
  const byline = el('div', undefined, 'bundle-byline');
  const proof = button(proofStatus, () => inspect('proofs'), 'status-line');
  if (model.proofs.some(p => p.verified)) proof.prepend(icon('check'));
  byline.append(el('span', edition.materials.length + ' sources · ' + edition.contexts.length + ' contributions'), proof); intro.append(byline);
  const tools = el('div', undefined, 'reading-tools');
  tools.append(button('Add interpretation', edit), button('Details', () => inspect('sources')), button('Save .else copy', exportPackage));
  root.append(intro, tools, feed);

  const inspector = el('dialog', undefined, 'reading-dialog inspector'); inspector.id = 'mixed-inspector'; inspector.setAttribute('aria-labelledby', 'mixed-details-title');
  const bar = el('div', undefined, 'dialog-bar'); const detailsTitle = el('h2', 'Behind the reading'); detailsTitle.id = 'mixed-details-title';
  bar.append(detailsTitle, button('Done', () => inspector.close()));
  const tabs = el('div', undefined, 'details-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'Details');
  const body = el('div', undefined, 'details-body'); body.setAttribute('role', 'tabpanel');
  let tab = 'sources';
  for (const [name, text] of [['sources','Sources'],['history','History'],['proofs','Proofs'],['export','Export']]) {
    const b = button(text, () => { tab = name; details(); b.focus(); }); b.dataset.tab = name; b.id = 'mixed-tab-' + name; b.setAttribute('role', 'tab');
    b.onkeydown = event => { if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) { event.preventDefault(); const all = [...tabs.children], index = all.indexOf(b); const next = event.key === 'Home' ? 0 : event.key === 'End' ? all.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length; all[next].click(); } }; tabs.append(b);
  }
  inspector.append(bar, tabs, body); root.append(inspector);
  function inspect(name) { pauseMedia(); tab = name; details(); if (!inspector.open) inspector.showModal(); }
  function block(title, text) { const n = el('section', undefined, 'detail-block'); n.append(el('h3', title)); if (text) n.append(el('p', text)); return n; }
  function technical(n, label, text) { const d = el('details'); d.append(el('summary', label), el('pre', text)); n.append(d); }
  function details() {
    body.replaceChildren(); body.setAttribute('aria-labelledby', 'mixed-tab-' + tab);
    for (const b of tabs.children) { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); b.tabIndex = b.dataset.tab === tab ? 0 : -1; }
    if (tab === 'sources') for (const id of edition.materials) {
      const m = model.materials[id], n = block(m.title, m.creator);
      n.append(el('p', m.blob ? 'The original file is included. Pull it out to use in your usual reader.' : 'The reference is saved. Its live source can change or disappear.'));
      if (m.url) n.append(sourceControl(m));
      if (m.excerpt) { const d = el('details'); d.append(el('summary', 'Saved text'), el('p', model.text(m.excerpt))); n.append(d, el('small', m.method)); }
      technical(n, 'Content identity', id + (m.blob ? '\nOriginal file SHA-256: ' + m.blob : '')); body.append(n);
    }
    if (tab === 'history') {
      const label = el('label', 'Choose an edition'); label.htmlFor = 'mixed-edition'; const select = el('select'); select.id = 'mixed-edition'; select.setAttribute('aria-label', 'Edition history');
      for (const [id, e] of Object.entries(model.editions)) { const o = el('option', e.title + ' / ' + e.editor + ' / ' + id.slice(0,8)); o.value = id; o.selected = id === head; select.append(o); }
      select.onchange = () => selectEdition(select.value); body.append(label, select);
      for (const [id, e] of Object.entries(model.editions).reverse()) { const n = block(id === head ? 'Selected edition' : 'Earlier or other edition', e.title); n.append(el('p', 'Editor: ' + e.editor)); technical(n, 'Edition identity', id + '\nParents: ' + (e.parents.join(', ') || 'None')); body.append(n); }
      for (const id of edition.contexts) { const c = model.contexts[id], n = block(c.author.name, c.author.kind === 'ai' ? 'AI proposal / ' + c.author.generator : 'Human contribution, declared'); if (c.text) n.append(el('p', model.text(c.text))); if (c.transcriptMethod) n.append(el('small', c.transcriptMethod)); technical(n, 'Contribution identity', id); body.append(n); }
    }
    if (tab === 'proofs') {
      body.append(block(proofStatus, 'A valid signature identifies the signing key and the edition it signed. A person’s identity, accuracy and permission require their own confirmation.'));
      if (!model.proofs.length) body.append(block('No signatures attached', 'Carry can review and sign this edition with the phone’s existing key.'));
      for (const p of model.proofs) { const n = block(p.signer.name, p.verified ? 'Signature valid. ' + (p.edition === head ? 'Current edition.' : 'Earlier edition.') + ' Human identity is not confirmed here.' : p.limitation); n.append(el('p', 'Purpose: ' + p.purpose)); technical(n, 'Key and edition details', 'Fingerprint: ' + p.fingerprint + '\nEdition: ' + p.edition); body.append(n); }
    }
    if (tab === 'export') {
      const n = block('Take it with you', 'Save the complete .else, or an original without the surrounding context.');
      n.append(button('Save .else copy', exportPackage));
      for (const id of edition.materials) { const m = model.materials[id]; if (m.blob) n.append(button('Save original PDF', () => save(model.blob(m.blob), m.filename, 'pdf'))); }
      for (const id of edition.contexts) { const c = model.contexts[id]; if (c.audio) n.append(button('Save original voice', () => save(model.blob(c.audio), c.filename, 'audio'))); }
      n.append(button('Save AI context', () => save(new TextEncoder().encode(mixedContext(model, head)), 'Mixed-context.md', 'md'))); body.append(n);
      const ai = block('Context for an AI', 'Only this selected edition, its sources and attributed notes. No AI call is made here.'); const d = el('details'); const pre = el('pre', mixedContext(model, head)); pre.id = 'mixed-ai-context'; d.append(el('summary', 'Preview Markdown'), pre); ai.append(d); body.append(ai);
    }
  }
  const pdfDialog = el('dialog', undefined, 'reading-dialog pdf-dialog'); pdfDialog.setAttribute('aria-label', 'Original PDF');
  const pdfBar = el('div', undefined, 'dialog-bar'), pdfTitle = el('h2'), pdfPages = el('div', undefined, 'pdf-pages'), pageLabel = el('span');
  const prev = button('Previous PDF page', () => { if (!pageBusy && page > 1) { page--; return drawPage(); } });
  const next = button('Next PDF page', () => { if (!pageBusy && page < pdfDoc?.numPages) { page++; return drawPage(); } });
  pdfBar.append(button('Done', () => pdfDialog.close()), pdfTitle, button('Save original PDF', () => save(model.blob(pdfMaterial.blob), pdfMaterial.filename, 'pdf')));
  const pageBar = el('div', undefined, 'pdf-page-bar'); pageBar.append(prev, pageLabel, next); pdfDialog.append(pdfBar, pdfPages, pageBar); root.append(pdfDialog);
  pdfDialog.addEventListener('close', () => { const task = pdfTask; pdfTask = null; pdfDoc = null; void task?.destroy(); });
  function newPDF(bytes) { return getDocument({ data: bytes.slice(), worker, isEvalSupported:false, enableXfa:false, useWasm:false, useWorkerFetch:false, disableAutoFetch:true, disableStream:true, maxImageSize:4*1024*1024, verbosity:0 }); }
  async function paint(doc, canvas, number = 1) { const p = await doc.getPage(number), natural = p.getViewport({scale:1}), view = p.getViewport({scale:Math.min(2,1500/natural.width,2200/natural.height)}); canvas.width = view.width; canvas.height = view.height; await p.render({canvasContext:canvas.getContext('2d'),viewport:view,annotationMode:AnnotationMode.DISABLE}).promise; }
  async function drawPage() { if (pageBusy || !pdfDoc) return; pageBusy = true; prev.disabled = next.disabled = true; try { const doc = pdfDoc, canvas = el('canvas'); canvas.setAttribute('aria-label','Original PDF, page ' + page); pdfPages.replaceChildren(canvas); await paint(doc,canvas,page); pageLabel.textContent = 'Page ' + page + ' of ' + doc.numPages; } finally { pageBusy = false; prev.disabled = page <= 1; next.disabled = !pdfDoc || page >= pdfDoc.numPages; } }
  async function openPDF(m) { pauseMedia(); pdfMaterial = m; page = 1; pdfTitle.textContent = m.title; pdfPages.replaceChildren(el('p','Preparing original PDF…')); pdfDialog.showModal(); const task = pdfTask = newPDF(model.blob(m.blob)); try { const doc = await task.promise; if (disposed || task !== pdfTask) return; if (doc.numPages > 200) throw Error('Save the original to read PDFs over 200 pages.'); pdfDoc = doc; await drawPage(); } catch(e) { if (!disposed && task === pdfTask) pdfPages.replaceChildren(el('p', e.message + ' The original is still available to save.')); } }
  function header(kind,title,author,fn) { const n = el('div',undefined,'source-head'), symbol = el('span',undefined,'source-symbol'), info = el('div',undefined,'source-info'); symbol.append(icon(kind)); info.append(el('h3',title),el('p',author,'caption')); n.append(symbol,info,button('Details',fn,'source-more')); return n; }
  function note(c) { const n = el('div',undefined,'reading-note'), author = el('div',undefined,'note-author'); author.append(el('span',c.author.name),el('span',c.author.kind === 'ai' ? 'AI proposal' : 'Declared contribution',c.author.kind === 'ai' ? 'ai-label' : '')); n.append(author,el('p',model.text(c.text))); return n; }
  function videoCommand(frame, command) { if (command === 'pauseVideo' && !playingFrames.has(frame)) return; frame.contentWindow?.postMessage({type:'pause',nonce:videoNonces.get(frame)}, 'https://sources.dotelse.app'); }
  function pauseMedia(except = null) { audios.forEach(a => { if (a !== except) a.pause(); }); frames.forEach(f => { if (f !== except) videoCommand(f,'pauseVideo'); }); }
  const observe = new IntersectionObserver(entries => { for (const e of entries) if (!e.isIntersecting) { if (e.target.tagName === 'AUDIO') e.target.pause(); else videoCommand(e.target,'pauseVideo'); } }); cleanups.push(() => observe.disconnect());
  function voice(c) {
    const panel = el('div',undefined,'voice-panel'), audio = el('audio'); audio.preload = 'metadata'; audio.src = blobURL(model.blob(c.audio),c.mime); audios.push(audio); observe.observe(audio);
    const play = button('', () => audio.paused ? audio.play() : audio.pause(),'play-voice'); play.append(icon('play')); play.setAttribute('aria-label','Play original audio');
    const right = el('div',undefined,'wave-and-time'), wave = el('div',undefined,'waveform'), times = el('div',undefined,'voice-time'), elapsed = el('span','0:00'), duration = el('span','Audio'); wave.setAttribute('aria-hidden','true');
    const bars = Array.from({length:46},() => { const b = el('span'); b.style.height = '5px'; wave.append(b); return b; });
    void (async () => { let decoder; try { decoder = new AudioContext(); const decoded = await decoder.decodeAudioData(model.blob(c.audio).slice().buffer), channel = decoded.getChannelData(0); const levels = bars.map((_,i) => { const start = Math.floor(i*channel.length/bars.length), end = Math.floor((i+1)*channel.length/bars.length); let sum = 0; for(let j=start;j<end;j++) sum += channel[j] ** 2; return Math.sqrt(sum/Math.max(1,end-start)); }); const max = Math.max(...levels,.00001); if(!disposed) bars.forEach((b,i) => b.style.height = (4+23*levels[i]/max)+'px'); } catch {} finally { await decoder?.close(); } })();
    const seek = el('input',undefined,'voice-scrub'); seek.type = 'range'; seek.min = 0; seek.max = 1; seek.step = .01; seek.value = 0; seek.setAttribute('aria-label','Audio position'); seek.oninput = () => { if(Number.isFinite(audio.duration)) audio.currentTime = Number(seek.value)*audio.duration; };
    times.append(elapsed,duration); right.append(wave,times,seek); panel.append(play,right,audio);
    audio.onloadedmetadata = () => duration.textContent = time(audio.duration);
    audio.ontimeupdate = () => { const ratio = audio.currentTime/audio.duration || 0; elapsed.textContent = time(audio.currentTime); seek.value = ratio; bars.forEach((b,i) => b.classList.toggle('played',i/bars.length < ratio)); };
    audio.onplay = () => { pauseMedia(audio); play.replaceChildren(icon('pause')); play.setAttribute('aria-label','Pause audio'); };
    audio.onpause = audio.onended = () => { play.replaceChildren(icon('play')); play.setAttribute('aria-label','Play original audio'); };
    return panel;
  }
  for (const id of edition.materials) {
    const m = model.materials[id], article = el('article',undefined,'material'); article.id = 'material-' + id; article.append(header(m.kind === 'pdf' ? 'pdf' : m.kind === 'social' ? 'post' : 'video',m.title,m.creator,() => inspect('sources')));
    if (m.kind === 'pdf') {
      const preview = button('',() => openPDF(m),'pdf-preview'), canvas = el('canvas'), expand = el('span',undefined,'preview-expand'); preview.setAttribute('aria-label','Expand original PDF: ' + m.title); canvas.setAttribute('aria-label','First page of the original PDF'); expand.append(icon('expand')); preview.append(canvas,expand); article.append(preview);
      const meta = el('div',undefined,'under-media'); meta.append(el('span','Original PDF included'),button('Save original PDF',() => save(model.blob(m.blob),m.filename,'pdf')));
      const drag = el('a','Drag original PDF out'); drag.draggable = true; drag.href = blobURL(model.blob(m.blob),m.mime); drag.download = m.filename; drag.ondragstart = event => { if(desktop) { event.preventDefault(); void desktop.dragPDF({bytes:model.blob(m.blob),name:m.filename,kind:'pdf'}).catch(e => status(e.message,true)); } else event.dataTransfer.setData('DownloadURL',m.mime + ':' + m.filename + ':' + drag.href); }; meta.append(drag); article.append(meta);
      const task = newPDF(model.blob(m.blob)); tasks.push(task); void task.promise.then(doc => { if(doc.numPages > 200) throw Error(); return paint(doc,canvas); }).catch(() => { if(!disposed) { canvas.remove(); preview.append(el('p','Preview unavailable. Save the original PDF.')); } });
    } else if(m.kind === 'social') {
      const fallback = el('div',undefined,'social-fallback'), person = el('div',undefined,'social-person'), name = el('div',m.creator); name.append(el('small','Saved source excerpt')); person.append(el('span',(m.creator || 'S').slice(0,1),'avatar-initial'),name); fallback.append(person,el('p',m.excerpt ? model.text(m.excerpt) : m.title,'social-excerpt'),el('small','The live post appears here when available. Your saved reference remains intact.'));
      article.append(fallback); const u = new URL(m.url), match = /^(?:www\.)?(?:x|twitter)\.com$/.test(u.hostname) && /^\/[^/]+\/status\/(\d+)$/.exec(u.pathname);
      if(match && navigator.onLine) {
        const frame = el('iframe',undefined,'social-embed pending-post'); frame.title = 'Live X post'; frame.setAttribute('aria-hidden','true'); frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups'); frame.referrerPolicy = 'strict-origin-when-cross-origin'; const nonce = crypto.randomUUID(), target = new URL('https://sources.dotelse.app/live-post.html'); target.hash = new URLSearchParams({id:match[1],nonce}); frame.src = target.href; article.insertBefore(frame,fallback);
        const listener = event => { if(event.source !== frame.contentWindow || event.origin !== target.origin || event.data?.nonce !== nonce) return; if(event.data.type === 'ready') { frame.classList.remove('pending-post'); frame.removeAttribute('aria-hidden'); fallback.hidden = true; } if(event.data.type === 'height' && Number.isFinite(event.data.height)) frame.style.height = Math.max(200,Math.min(1800,event.data.height)) + 'px'; }; window.addEventListener('message',listener); cleanups.push(() => window.removeEventListener('message',listener));
      }
      const meta = el('div',undefined,'under-media'); meta.append(el('span',navigator.onLine ? 'Live source + saved reference' : 'Saved reference, offline'),sourceControl(m)); article.append(meta);
    } else if(m.kind === 'youtube') {
      const wrap = el('div',undefined,'video-container'), frame = el('div',undefined,'video-frame'), iframe = el('iframe'); iframe.title = m.title + ', YouTube passage'; iframe.referrerPolicy = 'strict-origin-when-cross-origin'; iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture'; iframe.allowFullscreen = true; iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');
      const nonce = crypto.randomUUID(), sourceURL = new URL('https://sources.dotelse.app/live-video.html'); sourceURL.hash = new URLSearchParams({id:new URL(m.url).searchParams.get('v'),start:m.start,end:m.end,nonce}); videoNonces.set(iframe,nonce); if(navigator.onLine) iframe.src = sourceURL.href;
      frame.append(iframe); frames.push(iframe); observe.observe(iframe); wrap.append(frame);
      const meta = el('div',undefined,'under-media'); meta.append(el('span',time(m.start) + ' to ' + time(m.end) + ' / YouTube passage'),button('Expand video',() => fullVideo ? closeVideo() : expandVideo(wrap))); wrap.append(meta); article.append(wrap);
      if(!navigator.onLine) article.append(el('p','Video is offline. The saved passage and source remain below.','video-caption'));
      if(m.excerpt) article.append(el('p',model.text(m.excerpt),'video-caption')); article.append(sourceControl(m));
      const listener = event => { if(event.source !== iframe.contentWindow || event.origin !== sourceURL.origin || event.data?.nonce !== nonce) return; if(event.data.type === 'state' && event.data.state === 1) { playingFrames.add(iframe); pauseMedia(iframe); } else if(event.data.type === 'state' && [0,2].includes(event.data.state)) playingFrames.delete(iframe); }; window.addEventListener('message',listener); cleanups.push(() => window.removeEventListener('message',listener));
    }
    for(const cid of edition.contexts) { const c = model.contexts[cid]; if(c.material === id && c.text) article.append(note(c)); } feed.append(article);
  }
  for(const cid of edition.contexts) {
    const c = model.contexts[cid]; if(c.material && !c.audio) continue; const article = el('article',undefined,'context-item'); article.append(header(c.audio ? 'voice' : 'note',c.audio ? 'A voice alongside it' : 'Another interpretation',c.author.name + (c.author.kind === 'ai' ? ' / AI proposal' : ' / declared contribution'),() => inspect('history')));
    if(c.material) article.append(el('p','Alongside: ' + model.materials[c.material].title,'caption')); if(!c.material && c.text) article.append(el('p',model.text(c.text),'body-note')); if(c.audio) article.append(voice(c)); if(c.transcript) { const d = el('details',undefined,'transcript'); d.append(el('summary','Transcript / description'),el('p',model.text(c.transcript))); article.append(d); } feed.append(article);
  }
  const end = el('div',undefined,'reading-end'); end.append(el('p','A place to pause.'),button('Add interpretation',edit)); feed.append(end);
  function expandVideo(wrap) { pauseMedia(frames.find(f => wrap.contains(f))); fullVideo = wrap; videoFocus = document.activeElement; wrap.classList.add('video-full'); wrap.setAttribute('role','dialog'); wrap.setAttribute('aria-modal','true'); wrap.setAttribute('aria-label','Expanded video'); wrap.tabIndex = -1; let node = wrap; while(node.parentElement) { for(const sibling of node.parentElement.children) if(sibling !== node && sibling.tagName !== 'SCRIPT') { oldInert.push([sibling,sibling.inert]); sibling.inert = true; } node = node.parentElement; } document.body.style.overflow = 'hidden'; wrap.querySelector('button').textContent = 'Close expanded video'; wrap.focus(); }
  function closeVideo() { if(!fullVideo) return; fullVideo.classList.remove('video-full'); for(const name of ['role','aria-modal','aria-label','tabindex']) fullVideo.removeAttribute(name); fullVideo.querySelector('button').textContent = 'Expand video'; oldInert.forEach(([n,v]) => n.inert = v); oldInert = []; document.body.style.overflow = ''; fullVideo = null; videoFocus?.focus(); }
  const keyListener = event => { if(!fullVideo) return; if(event.key === 'Escape') { event.preventDefault(); closeVideo(); } if(event.key === 'Tab') { const all = [...fullVideo.querySelectorAll('button,iframe')]; if(event.shiftKey && [all[0],fullVideo].includes(document.activeElement)) { event.preventDefault(); all.at(-1).focus(); } else if(!event.shiftKey && document.activeElement === all.at(-1)) { event.preventDefault(); all[0].focus(); } } };
  const visibility = () => { if(document.hidden) pauseMedia(); }; document.addEventListener('keydown',keyListener); document.addEventListener('visibilitychange',visibility); cleanups.push(() => document.removeEventListener('keydown',keyListener),() => document.removeEventListener('visibilitychange',visibility));
  return () => { disposed = true; pauseMedia(); closeVideo(); [inspector,pdfDialog].forEach(d => { if(d.open) d.close(); }); void pdfTask?.destroy(); tasks.forEach(t => void t.destroy()); cleanups.forEach(f => f()); };
}
