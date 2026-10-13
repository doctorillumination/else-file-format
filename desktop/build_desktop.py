#!/usr/bin/env python3
"""Bundle only the public authoring application and its offline specimen."""
from pathlib import Path
import json
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from build_site import site_page
from reader import read_package

DESTINATION = ROOT / 'desktop/app'


def main():
    if DESTINATION.exists():
        shutil.rmtree(DESTINATION)
    DESTINATION.mkdir()
    model, pdf = read_package(ROOT / 'specimen/One-file-two-readings.else')
    html = site_page(model, pdf)
    for section in ['about', 'desktop']:
        html = re.sub(r'<section class="' + section + r'".*?</section>', '', html, flags=re.S)
    html = html.replace('<a href="#about">About the format</a><a href="#desktop">Desktop app</a>',
                        '<a href="https://dotelse.app/">Website</a>')
    html = html.replace('<link rel="stylesheet" href="site.css">',
                        '<link rel="stylesheet" href="site.css"><link rel="stylesheet" href="desktop.css">')
    html = html.replace('Your files stay in this tab.', 'Your files stay on this computer.')
    html = html.replace('room<br>for', 'room for')
    html = html.replace('This draft stays in this tab until you save it.', 'Save a .else copy to keep your changes.')
    html = html.replace('Saving downloads the .else and opens it in the reader below. Reloading clears the draft.',
                        'Saving opens the .else in the reader below. Save a copy to keep your work.')
    html = html.replace('Reloading clears unsaved work.', 'Save a .else copy to keep your work.')
    (DESTINATION / 'index.html').write_text(html, encoding='utf-8')
    names = ['reader.mjs', 'format.mjs', 'preview.mjs', 'create.mjs', 'site.css', 'mixed.html', 'mixed.css', 'mixed.mjs', 'mixed-format.mjs', 'mixed-reading.mjs', 'mixed-reading.css', 'mixed-sample.mjs', 'source-viewer.html', 'source-viewer.mjs']
    for name in names:
        shutil.copyfile(ROOT / 'web' / name, DESTINATION / name)
    shutil.copytree(ROOT / 'web/source', DESTINATION / 'source', dirs_exist_ok=True)
    (DESTINATION / 'vendor').mkdir(exist_ok=True)
    for name in ['pdf.mjs', 'pdf.worker.mjs', 'PDFJS-LICENSE']:
        shutil.copyfile(ROOT / 'web/vendor' / name, DESTINATION / 'vendor' / name)
    shutil.copyfile(ROOT / 'assets/ElseIcon.png', DESTINATION / 'ElseIcon.png')
    shutil.copyfile(ROOT / 'LICENSE', DESTINATION / 'LICENSE.txt')
    shutil.copyfile(ROOT / 'desktop/desktop.css', DESTINATION / 'desktop.css')
    allowed = sorted(p.relative_to(DESTINATION).as_posix() for p in DESTINATION.rglob('*') if p.is_file() and p.name != 'manifest.json')
    (DESTINATION / 'manifest.json').write_text(json.dumps(allowed, indent=2) + '\n')
    print('Built the offline desktop application in desktop/app/.')


if __name__ == '__main__':
    main()
