'use strict';
const path = require('node:path');
const { readFile, open } = require('node:fs/promises');

const ORIGIN = 'app://else';
const HOME = ORIGIN + '/index.html';
const MAX_ARCHIVE = 64 * 1024 * 1024;
const MAX_PDF = 12 * 1024 * 1024;
const POLICY = "default-src 'none'; style-src 'self'; script-src 'self'; worker-src 'self'; connect-src 'none'; frame-src https://sources.dotelse.app https://www.youtube-nocookie.com; object-src 'none'; img-src 'self' data:; media-src blob:; font-src blob: data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

function assetName(address, allowed) {
  const url = new URL(address);
  if (url.protocol !== 'app:' || url.host !== 'else' || url.username || url.password || url.search) return null;
  const name = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
  return allowed.has(name) ? name : null;
}


function inlineSourceURL(address) {
  try {
    const u = new URL(address);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return false;
    return (u.hostname === 'sources.dotelse.app' && /^\/live-(?:post|video)\.html$/.test(u.pathname) && !u.search) ||
      (u.hostname === 'www.youtube-nocookie.com' && /^\/embed\/[\w-]{11}$/.test(u.pathname));
  } catch { return false; }
}

function sourceFrame(frame) {
  // The root archive frame never gains network access. Remote descendants have no file bridge.
  for (let depth = 0; frame && depth < 12; depth++, frame = frame.parent) {
    if (!frame.parent) return false;
    if (inlineSourceURL(frame.url)) return true;
  }
  return false;
}
function inlineRequest(details) {
  try {
    const u = new URL(details.url);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || details.resourceType === 'mainFrame') return false;
    return sourceFrame(details.frame) || (details.resourceType === 'subFrame' && inlineSourceURL(details.url) && !!details.frame?.parent);
  } catch { return false; }
}

function externalLink(address) {
  try {
    const url = new URL(address);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    return url.hostname === 'dotelse.app' ||
      (url.hostname === 'github.com' && (url.pathname === '/doctorillumination/else-file-format' || url.pathname.startsWith('/doctorillumination/else-file-format/'))) ||
      (url.hostname === 'cyberdelic.space' && url.pathname === '/project/cyberdelic-os/field-notes/fn-45/');
  } catch { return false; }
}

function safeFilename(name, extension) {
  if (typeof name !== 'string' || !name || name !== path.basename(name) || /[\\/:\x00-\x1f]/.test(name) || name.length > 240 || !name.toLowerCase().endsWith('.' + extension)) throw new Error('Invalid export filename.');
  return name;
}

async function openedFile(filename) {
  const extension = path.extname(filename).toLowerCase();
  const maximum = extension === '.pdf' ? MAX_PDF : extension === '.else' ? MAX_ARCHIVE : 0;
  if (!maximum) throw new Error('Choose a PDF or .else file.');
  const file = await open(filename, 'r');
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maximum) throw new Error('Choose a PDF up to 12 MiB, or a .else up to 64 MiB.');
    const bytes = Buffer.alloc(stat.size + 1);
    const { bytesRead } = await file.read(bytes, 0, bytes.length, 0);
    if (bytesRead !== stat.size) throw new Error('The file changed while it was being opened. Choose it again.');
    return { name: path.basename(filename), bytes: new Uint8Array(bytes.subarray(0, bytesRead)) };
  } finally { await file.close(); }
}

function exportedBytes(value) {
  if (!value || !(value.bytes instanceof Uint8Array) || !['pdf', 'else', 'md', 'audio'].includes(value.kind)) throw new Error('Unsupported export.');
  const extension = value.kind === 'audio' ? path.extname(value.name).slice(1).toLowerCase() : value.kind;
  if (value.kind === 'audio' && !['wav', 'm4a', 'mp3', 'ogg', 'webm'].includes(extension)) throw new Error('Unsupported audio export.');
  safeFilename(value.name, extension);
  const maximum = ['pdf', 'audio'].includes(value.kind) ? MAX_PDF : value.kind === 'md' ? 2 * 1024 * 1024 : MAX_ARCHIVE;
  if (value.bytes.length > maximum || !value.bytes.length) throw new Error('Export is too large or empty.');
  const bytes = Buffer.from(value.bytes);
  if (value.kind === 'pdf' && bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('Invalid PDF export.');
  return bytes;
}

module.exports = { ORIGIN, HOME, POLICY, assetName, externalLink, safeFilename, openedFile, exportedBytes, readFile, inlineSourceURL, inlineRequest };
