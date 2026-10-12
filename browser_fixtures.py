#!/usr/bin/env python3
"""Synthetic changed-package and privacy fixtures, never private app data."""
import json
from pathlib import Path

import reader
from test_experiment import encode, indexed, original, write_archive


def plain_pdf(pages):
    """Small synthetic PDFs with a valid cross-reference table, no PDF dependencies."""
    objects = [b'<< /Type /Catalog /Pages 2 0 R >>', b'']
    kids = []
    for words in pages:
        page = len(objects) + 1
        kids.append(f'{page} 0 R')
        objects.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 540 720] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents {page + 1} 0 R >>'.encode())
        content = f'BT /F1 14 Tf 48 650 Td ({words}) Tj ET'.encode()
        objects.append(f'<< /Length {len(content)} >>\nstream\n'.encode() + content + b'\nendstream')
    objects[1] = f'<< /Type /Pages /Count {len(pages)} /Kids [{" ".join(kids)}] >>'.encode()
    data = bytearray(b'%PDF-1.4\n')
    offsets = [0]
    for number, value in enumerate(objects, 1):
        offsets.append(len(data))
        data.extend(f'{number} 0 obj\n'.encode() + value + b'\nendobj\n')
    start = len(data)
    data.extend(f'xref\n0 {len(objects) + 1}\n0000000000 65535 f \n'.encode())
    for offset in offsets[1:]:
        data.extend(f'{offset:010d} 00000 n \n'.encode())
    data.extend(f'trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{start}\n%%EOF\n'.encode())
    return bytes(data)


def write_fixtures(folder):
    folder = Path(folder)
    folder.mkdir(parents=True, exist_ok=True)
    entries = dict(original)
    manifest = json.loads(entries['manifest.json'])
    material = json.loads(entries.pop('records/' + manifest['material'] + '.json'))
    material['title'] = 'A local reading <img src="https://example.invalid/do-not-load">'
    material['source']['description'] = 'Synthetic changed-package fixture. The PDF remains original; the surrounding readings differ.'
    material_data = encode(material)
    material_id = reader.digest(material_data)
    entries['records/' + material_id + '.json'] = material_data
    contexts = []
    for number, ref in enumerate(manifest['contexts']):
        context = json.loads(entries.pop('records/' + ref + '.json'))
        entries.pop('blobs/sha256/' + context['text'])
        words = ('LOCAL_CONTEXT_SENTINEL: Café, a leaf 🌿, and a different reading. '
                 '<script>fetch("https://example.invalid/do-not-send")</script>') if number == 0 else 'A second synthetic response stays distinct from the first.'
        data = words.encode('utf-8')
        text_id = reader.digest(data)
        entries['blobs/sha256/' + text_id] = data
        context.update(target=material_id, text=text_id)
        context['author']['name'] = 'Synthetic test contributor (AI-labelled fixture)'
        context['author']['generator'] = 'Browser import test fixture'
        context_data = encode(context)
        context_id = reader.digest(context_data)
        entries['records/' + context_id + '.json'] = context_data
        contexts.append(context_id)
    entries['manifest.json'] = encode({**manifest, 'material': material_id, 'contexts': contexts})
    valid = folder / 'Local-reading.else'
    write_archive(valid, indexed(entries))
    model, pdf = reader.read_package(valid)
    (folder / 'expected.json').write_text(json.dumps(model, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (folder / 'expected-context.md').write_text(reader.ai_context(model), encoding='utf-8')
    (folder / 'expected.pdf').write_bytes(pdf)
    private = dict(entries)
    unselected = b'UNSELECTED_PRIVATE_SENTINEL_DO_NOT_EXPORT'
    private['blobs/sha256/' + reader.digest(unselected)] = unselected
    write_archive(folder / 'Unselected-note.else', indexed(private))
    (folder / 'Truncated.else').write_bytes(valid.read_bytes()[:-1])
    (folder / 'Two-pages.pdf').write_bytes(plain_pdf(['SYNTHETIC_FIRST_PAGE', 'SYNTHETIC_SECOND_PAGE']))
    (folder / 'No-selectable-text.pdf').write_bytes(plain_pdf(['']))
    (folder / 'Not-a-PDF.pdf').write_bytes(b'This is deliberately not a PDF.')
    return valid


if __name__ == '__main__':
    write_fixtures(Path(__file__).resolve().parent / 'output/browser-fixtures')
    print('Created synthetic browser test fixtures.')
