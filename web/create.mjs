// Local writer for the existing bounded, unsigned two-readings profile.
import { MAX_ENTRY, MAX_ARCHIVE, crc32, digest, readPackage } from './format.mjs';

const encoder = new TextEncoder();
const encoded = (value) => encoder.encode(JSON.stringify(value) + '\n');

export function pdfFilename(name) {
  if (typeof name !== 'string' || Array.from(name).length > 180 || /[\/\\:\x00-\x1f]/.test(name) || !/\.pdf$/i.test(name)) {
    throw new Error('Use a PDF filename of at most 180 characters, without slashes, colons or control characters. Rename the file on your computer and try again.');
  }
  return name;
}

function storedZIP(entries) {
  const parts = [];
  const directory = [];
  let offset = 0;
  for (const [name, bytes] of entries) {
    const filename = encoder.encode(name);
    const crc = crc32(bytes);
    const local = new Uint8Array(30 + filename.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x800, true);
    // ZIP requires a DOS date. This fixed date carries no provenance claim.
    view.setUint16(12, 33, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, bytes.length, true);
    view.setUint32(22, bytes.length, true);
    view.setUint16(26, filename.length, true);
    local.set(filename, 30);
    const central = new Uint8Array(46 + filename.length);
    const index = new DataView(central.buffer);
    index.setUint32(0, 0x02014b50, true);
    index.setUint16(4, 20, true);
    index.setUint16(6, 20, true);
    index.setUint16(8, 0x800, true);
    index.setUint16(14, 33, true);
    index.setUint32(16, crc, true);
    index.setUint32(20, bytes.length, true);
    index.setUint32(24, bytes.length, true);
    index.setUint16(28, filename.length, true);
    index.setUint32(38, 0o100644 << 16, true);
    index.setUint32(42, offset, true);
    central.set(filename, 46);
    parts.push(local, bytes);
    directory.push(central);
    offset += local.length + bytes.length;
  }
  const directorySize = directory.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, entries.size, true);
  view.setUint16(10, entries.size, true);
  view.setUint32(12, directorySize, true);
  view.setUint32(16, offset, true);
  const result = new Uint8Array(offset + directorySize + end.length);
  if (result.length > MAX_ARCHIVE) throw new Error('The .else file exceeds the experiment size limit.');
  let position = 0;
  for (const part of [...parts, ...directory, end]) { result.set(part, position); position += part.length; }
  return result;
}

export async function writePackage({ pdf, filename, title, source, sourceText, interpretations }) {
  pdfFilename(filename);
  if (!(pdf instanceof Uint8Array) || pdf.length > MAX_ENTRY || !pdf.slice(0, 5).every((byte, index) => byte === [37, 80, 68, 70, 45][index]) || pdf.length < 5) {
    throw new Error('Choose a PDF no larger than 12 MiB.');
  }
  if (!Array.isArray(interpretations) || interpretations.length !== 2) throw new Error('Add exactly two interpretations.');
  const entries = new Map([['mimetype', encoder.encode('application/x-cyberdelic-else-experiment')]]);
  async function include(bytes, record = false) {
    const ref = await digest(bytes);
    entries.set(record ? `records/${ref}.json` : `blobs/sha256/${ref}`, bytes);
    return ref;
  }
  const material = await include(encoded({ type: 'material', title, filename, mime: 'application/pdf',
    pdf: await include(pdf), text: await include(encoder.encode(sourceText)), source }), true);
  const contexts = [];
  for (const reading of interpretations) {
    contexts.push(await include(encoded({ type: 'context', title: reading.title, target: material,
      author: reading.author, status: 'demonstration', text: await include(encoder.encode(reading.text)) }), true));
  }
  entries.set('manifest.json', encoded({ format: 'cyberdelic-else', version: '0.1-experimental',
    profile: 'two-readings/0.1-experimental', material, contexts, requiredCapabilities: [], signatures: [] }));
  const files = {};
  for (const [name, bytes] of entries) files[name] = { sha256: await digest(bytes), bytes: bytes.length };
  entries.set('integrity/files.json', encoded({ files }));
  const bytes = storedZIP(entries);
  // Validate the finished archive before making it available for download.
  await readPackage(bytes);
  return bytes;
}
