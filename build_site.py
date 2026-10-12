#!/usr/bin/env python3
"""Build the static .else website from public templates and the specimen."""
from pathlib import Path
import base64
import shutil
from reader import ai_context, read_package

ROOT = Path(__file__).resolve().parent
SITE = ROOT / 'docs'
REPOSITORY = 'https://github.com/doctorillumination/else-file-format'
DOWNLOAD = REPOSITORY + '/releases/download/v0.1.0-experiment/Else-Experiment-macOS-universal.zip'


def site_page(model, pdf):
    template = (ROOT / 'web/site.html').read_text(encoding='utf-8')
    replacements = {
        '__REPOSITORY__': REPOSITORY,
        '__DOWNLOAD__': DOWNLOAD,
        '__CREATOR__': (ROOT / 'web/creator.html').read_text(encoding='utf-8'),
        '__SAMPLE_PACKAGE__': base64.b64encode((ROOT / 'specimen/One-file-two-readings.else').read_bytes()).decode(),
    }
    for key, value in replacements.items():
        template = template.replace(key, value)
    return template


def main():
    model, pdf = read_package(ROOT / 'specimen/One-file-two-readings.else')
    SITE.mkdir(exist_ok=True)
    (SITE / 'index.html').write_text(site_page(model, pdf), encoding='utf-8')
    (SITE / '.nojekyll').write_text('', encoding='utf-8')
    (SITE / 'context.md').write_text(ai_context(model), encoding='utf-8')
    (SITE / model['filename']).write_bytes(pdf)
    shutil.copyfile(ROOT / 'assets/ElseIcon.png', SITE / 'ElseIcon.png')
    shutil.copyfile(ROOT / 'specimen/One-file-two-readings.else', SITE / 'One-file-two-readings.else')
    for name in ['reader.mjs', 'format.mjs', 'preview.mjs', 'create.mjs', 'site.css']:
        shutil.copyfile(ROOT / 'web' / name, SITE / name)
    (SITE / 'vendor').mkdir(exist_ok=True)
    for name in ['pdf.mjs', 'pdf.worker.mjs', 'PDFJS-LICENSE']:
        shutil.copyfile(ROOT / 'web/vendor' / name, SITE / 'vendor' / name)
    if (ROOT / 'web/_headers').exists():
        shutil.copyfile(ROOT / 'web/_headers', SITE / '_headers')
    print('Built the .else website in docs/.')


if __name__ == '__main__':
    main()
