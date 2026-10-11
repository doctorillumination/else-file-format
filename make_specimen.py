#!/usr/bin/env python3
"""Create the public, AI-authored PDF specimen. Not an app exporter."""
import hashlib
import json
from pathlib import Path
import zipfile
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'specimen'
OUT.mkdir(exist_ok=True)
pdf_path = OUT / 'A-file-and-its-conversation.pdf'
pdf = canvas.Canvas(str(pdf_path), pagesize=(540, 720), invariant=1, pageCompression=0)
pdf.setTitle('A file and its conversation')
pdf.setAuthor('Codex (AI), demonstration specimen for Bradley')
pdf.setFillColor(HexColor('#f4f1e8'))
pdf.rect(0, 0, 540, 720, fill=1, stroke=0)
pdf.setFillColor(HexColor('#45634e'))
pdf.setFont('Helvetica', 9)
pdf.drawString(48, 660, 'CYBERDELIC OS / .ELSE / SPECIMEN 01')
pdf.setStrokeColor(HexColor('#b6c1ad'))
pdf.line(48, 638, 492, 638)
pdf.setFillColor(HexColor('#28392e'))
pdf.setFont('Times-Roman', 38)
pdf.drawString(48, 551, 'A file can travel')
pdf.drawString(48, 505, 'without its conversation.')
pdf.setFont('Times-Roman', 17)
for i, line in enumerate([
    'A page has its own life.',
    'It can be opened, copied, printed and passed on.',
    '',
    'An explanation gives it another life:',
    'why someone noticed it, what it recalled,',
    'what they hoped another person might see.',
    '',
    'Keep the page. Keep the difference.',
    'Let either travel when someone chooses.'
]):
    pdf.drawString(48, 416 - i * 25, line)
pdf.setStrokeColor(HexColor('#b6c1ad'))
pdf.line(48, 100, 492, 100)
pdf.setFont('Helvetica', 9)
pdf.setFillColor(HexColor('#61705d'))
pdf.drawString(48, 79, 'AI-authored demonstration material. Not a ratified Kernel text.')
pdf.drawString(48, 64, 'One ordinary PDF. Interpretations live outside these bytes.')
pdf.showPage()
pdf.save()

def encoded(obj):
    return (json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(',', ':')) + '\n').encode()

entries = {'mimetype': b'application/x-cyberdelic-else-experiment'}
def include(data, record=False):
    ref = hashlib.sha256(data).hexdigest()
    entries[('records/' + ref + '.json') if record else ('blobs/sha256/' + ref)] = data
    return ref

material = {
    'type': 'material', 'title': 'A file and its conversation',
    'filename': pdf_path.name, 'mime': 'application/pdf',
    'pdf': include(pdf_path.read_bytes()),
    'text': include(PdfReader(pdf_path).pages[0].extract_text().encode()),
    'source': {'kind': 'authored-demonstration', 'creator': 'Codex (AI)', 'description': 'Created for this local experiment at Bradley\'s request. Source text was extracted from the included one-page PDF. No external source or private collecting history is included.'}
}
material_id = include(encoded(material), True)
texts = [
    ('For use', 'Carry-like reading', 'I read this page as a practical promise: the object remains yours to use. The conversation can help you decide why it matters, but it should not become a toll you must pay to open the PDF. Carrying adds an addressed reason. Extracting gives you the ordinary page again. Both acts deserve a clear place in the reader.'),
    ('For encounter', 'Dear Elsewhere-like reading', 'I read the same page as an invitation to leave room between a thing and what we say about it. Two people may meet the same words differently. Their interpretations can sit beside the page without resolving it. The package preserves that encounter; the page can still depart alone. An ending belongs to a particular correspondence, not to the PDF itself.')
]
contexts = []
for title, role, words in texts:
    contexts.append(include(encoded({'type': 'context', 'title': title, 'target': material_id, 'author': {'kind': 'ai', 'name': 'Codex (AI)', 'role': role, 'generator': 'Codex / GPT-6'}, 'status': 'demonstration', 'text': include(words.encode())}), True))
entries['manifest.json'] = encoded({'format': 'cyberdelic-else', 'version': '0.1-experimental', 'profile': 'two-readings/0.1-experimental', 'material': material_id, 'contexts': contexts, 'requiredCapabilities': [], 'signatures': []})
entries['integrity/files.json'] = encoded({'files': {name: {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)} for name, data in entries.items()}})
with zipfile.ZipFile(OUT / 'One-file-two-readings.else', 'w', compression=zipfile.ZIP_STORED) as archive:
    for name, data in entries.items():
        info = zipfile.ZipInfo(name, date_time=(2026, 10, 11, 0, 0, 0))
        info.external_attr = 0o100644 << 16
        archive.writestr(info, data)
print(OUT / 'One-file-two-readings.else')
