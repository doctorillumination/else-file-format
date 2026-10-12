#!/usr/bin/env python3
"""Build the public specimen page using the independent Python reader."""
from pathlib import Path
import base64
import html
import re
import shutil

from reader import ai_context, browser_report, read_package

ROOT = Path(__file__).resolve().parent
SITE = ROOT / 'docs'
REPOSITORY = 'https://github.com/doctorillumination/else-file-format'
DOWNLOAD = REPOSITORY + '/releases/download/v0.1.0-experiment/Else-Experiment-macOS-universal.zip'


def site_page(model, pdf):
    page = browser_report(model, pdf)
    page = page.replace('<title>.else / The inspection reader</title>', '<title>.else / A file and its conversation</title>')
    page = page.replace("img-src data:", "img-src 'self' data:")
    page = page.replace("frame-src data:; object-src data:;", "script-src 'self'; worker-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; font-src blob: data:; base-uri 'none'; form-action 'none';")
    css = '''
    .site-nav{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:38px}.brand{display:flex;align-items:center;gap:14px;font:27px Georgia,serif}.brand img{width:52px;height:52px;border-radius:12px}.site-nav a{font-size:13px}.desktop{margin:36px 0 0;padding:28px 30px;background:#e3e6d9;border:1px solid #bdc7b2;border-radius:12px}.desktop h2{margin-top:0}.desktop .download{background:#526a4b;color:#f6f3e7;border-color:#526a4b}.platforms{font-size:13px;color:#4d6048}.platforms span{display:inline-block;margin:5px 20px 5px 0}.site-footer{font-size:12px;margin-top:26px;color:#60715e}.site-footer a{border:0;padding:0;text-decoration:underline;font-size:inherit}.note a{border:0;padding:0;text-decoration:underline;font-size:inherit}
    .opener{margin-bottom:34px;padding:24px 28px;border:1px dashed #7b8b6b;border-radius:12px;background:#e6e9dd;transition:background .15s,border-color .15s}.opener.drag-over{background:#d9e3cb;border:2px solid #526a4b;padding:23px 27px}.opener h2{font-size:25px;margin:0 0 8px}.opener p{margin:8px 0;max-width:85ch}.opener button{font:inherit;background:#526a4b;color:#f6f3e7;border:1px solid #526a4b;border-radius:6px;padding:9px 14px;cursor:pointer}.opener button:disabled{opacity:.6;cursor:wait}.open-status{font-size:13px;color:#405b3e}.open-error{color:#8a3024;font-size:14px}button:focus-visible,a:focus-visible,summary:focus-visible{outline:3px solid #526a4b;outline-offset:4px}a[aria-disabled="true"]{pointer-events:none;opacity:.6}#material-title{overflow-wrap:anywhere}#open-error[hidden]{display:none}
    .pdf-preview{border:1px solid #c1c6bc;background:#e5e5dc;padding:16px}.pdf-preview canvas{display:block;width:100%;height:auto;margin:auto}.pdf-preview canvas[hidden]{display:none}.pdf-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 14px;font-size:12px;color:#4d6048}.pdf-toolbar button{font:inherit;color:#405b3e;background:#f1f1e8;border:1px solid #a4b29b;border-radius:5px;padding:6px 9px;cursor:pointer}.pdf-toolbar button:disabled{opacity:.45;cursor:default}
    #readings{overflow-wrap:anywhere}#readings p{white-space:pre-wrap}
    [hidden]{display:none!important}.creator{margin:0 0 36px;padding:28px;border:1px solid #bdc7b2;border-radius:12px;background:#f5f2e9}.editor-head{display:flex;justify-content:space-between;align-items:start;gap:20px}.editor-head h2{font-size:32px;margin:8px 0}.editor-head p{font-size:13px;overflow-wrap:anywhere}.creator fieldset{min-width:0;border:1px solid #c1c6bc;border-radius:8px;padding:20px;margin:22px 0}.creator legend{font:22px Georgia,serif;padding:0 8px;color:#405b3e}.creator label{display:block;font-size:13px;font-weight:600;margin:16px 0 5px}.creator input,.creator textarea,.creator select{width:100%;min-width:0;font:inherit;color:#292d29;background:#fffdf7;border:1px solid #a4b29b;border-radius:5px;padding:10px}.creator textarea{resize:vertical}.creator input:focus-visible,.creator textarea:focus-visible,.creator select:focus-visible{outline:3px solid #526a4b;outline-offset:2px}.creator button{font:inherit;border:1px solid #9ba99a;border-radius:6px;background:transparent;color:#274e35;padding:9px 14px;cursor:pointer}.creator button.primary{background:#526a4b;color:#f6f3e7}.creator button:disabled{opacity:.6;cursor:wait}.interpretation-fields{display:grid;grid-template-columns:1fr 1fr;gap:22px}.interpretation-fields fieldset{margin-top:0}.creator pre{max-height:240px;overflow:auto}
    @media(max-width:600px){.site-nav{align-items:flex-start;flex-direction:column}.desktop,.opener,.creator{padding:22px}.opener.drag-over{padding:21px}.interpretation-fields{grid-template-columns:1fr;gap:0}.editor-head{flex-direction:column}.creator fieldset{padding:15px}}
    '''
    page = page.replace('</style>', css.strip() + '</style>')
    nav = f'''<nav class="site-nav" aria-label="Project"><div class="brand"><img src="ElseIcon.png" alt="Paired cream leaves on olive green"><span>.else</span></div><a href="{REPOSITORY}">Source and format</a></nav>'''
    page = page.replace('<main><header>', '<main>' + nav + '<header>')
    opener = '''<section class="opener" id="drop-zone" aria-labelledby="open-heading"><h2 id="open-heading">Bring a file here.</h2><p>Drop a PDF to create a .else, or a .else to read it. You can also choose a file below. Everything happens on your device. Nothing is uploaded.</p><button id="choose-file" type="button" disabled>Choose PDF or .else file</button><input id="package-file" type="file" accept=".else,.pdf,application/pdf" aria-label="Choose PDF or .else file" hidden><p class="open-status" id="open-status" role="status" aria-live="polite" aria-atomic="true">Public specimen shown below. Local files and drafts stay in this tab and clear when you reload.</p><p class="open-error" id="open-error" role="alert" hidden></p><p class="note">Creates from PDFs up to 12 MiB and 200 pages, with selectable text up to 65,536 characters. Reads the standalone two-readings format, up to 64 MiB.</p><noscript><p>Enable JavaScript to open or create local files. The public specimen is still readable below.</p></noscript></section>'''
    creator = (ROOT / 'web/creator.html').read_text(encoding='utf-8')
    page = page.replace('</nav>', '</nav>' + opener + creator + '<div id="reader-view">')
    page = page.replace('<h1>', '<h1 id="material-title">', 1)
    page = page.replace('<a href="data:application/pdf;', '<a id="save-pdf" href="data:application/pdf;', 1)
    page = page.replace('<a href="data:text/markdown;', '<a id="save-context" href="data:text/markdown;', 1)
    page = page.replace('<p class="note">Bytes checked', '<a id="save-package" href="One-file-two-readings.else" download>Save .else</a><p id="byte-status" class="note">Bytes checked', 1)
    preview = '<div class="pdf-preview"><div class="pdf-toolbar"><button id="pdf-previous" type="button" disabled>Previous</button><span id="pdf-page" role="status">Preparing the local PDF preview…</span><button id="pdf-next" type="button" disabled>Next</button></div><canvas id="pdf-canvas" role="img" aria-label="Original PDF preview" hidden></canvas></div>'
    preview += '<details><summary>Source text (extracted)</summary><pre id="source-view">' + html.escape(model['sourceText']) + '</pre></details>'
    page = re.sub(r'<iframe[^>]*></iframe>', preview, page, count=1)
    page = page.replace('<section><article>', '<section><div id="readings"><article>', 1)
    page = page.replace('<details><summary>AI-readable context</summary><pre>', '</div><details><summary>AI-readable context</summary><pre id="context-view">', 1)
    page = page.replace('<details><summary>Inspect source and evidence</summary><pre>', '<details><summary>Inspect source and evidence</summary><pre id="evidence-view">', 1)
    page = page.replace('The inspection reader, independently decoded in Python.', 'A file, with room for the context travelling beside it.')
    page = page.replace('The PDF is embedded unchanged. The native reader also supports dragging it to Finder.', 'The PDF keeps its original bytes. Its two interpretations travel beside it. Save the ordinary PDF or the selected AI-readable context whenever you choose.')
    desktop = f'''<section class="desktop" aria-labelledby="desktop-heading"><h2 id="desktop-heading">Take the reader with you.</h2><p>Read the same specimen offline. Keep the interpretations beside the page, inspect its AI-readable context, or pull out the ordinary PDF.</p><a class="download" href="{DOWNLOAD}">Download for macOS</a><a href="One-file-two-readings.else" download>Download the .else specimen</a><p class="platforms"><span>macOS: Apple silicon and Intel</span><span>Linux: desktop app planned</span><span>Windows: desktop app planned</span></p><p class="note">Experimental macOS build, targeting macOS 14 or later. It is locally signed and has not been notarized by Apple. If your Mac blocks the download, <a href="{REPOSITORY}#build-the-macos-reader">build from source</a>. The independent Python reader can also run on Linux and Windows.</p></section><footer class="site-footer">Public, AI-authored specimen. Two readings, no human ratification. This page has no account, upload form or analytics. <a href="{REPOSITORY}/blob/main/FORMAT.md">Experimental format</a> · <a href="https://cyberdelic.space/project/cyberdelic-os/field-notes/fn-45/">Field Note 45</a> · <a href="{REPOSITORY}/blob/main/LICENSE">MIT license</a></footer>'''
    desktop = desktop.replace('Public, AI-authored specimen. Two readings, no human ratification. This page has no account, upload form or analytics.', 'The public sample is AI-authored demonstration material. Files you open stay in this tab, with no upload, account or analytics.')
    page = page.replace('</main>', '</div>' + desktop + '</main>')
    initial = base64.b64encode((ROOT / 'specimen/One-file-two-readings.else').read_bytes()).decode()
    page += f'<template id="initial-package">{initial}</template><script type="module" src="reader.mjs"></script>\n'
    return page


def main():
    model, pdf = read_package(ROOT / 'specimen/One-file-two-readings.else')
    page = site_page(model, pdf)
    SITE.mkdir(exist_ok=True)
    (SITE / 'index.html').write_text(page, encoding='utf-8')
    (SITE / '.nojekyll').write_text('', encoding='utf-8')
    (SITE / 'context.md').write_text(ai_context(model), encoding='utf-8')
    (SITE / model['filename']).write_bytes(pdf)
    shutil.copyfile(ROOT / 'assets/ElseIcon.png', SITE / 'ElseIcon.png')
    shutil.copyfile(ROOT / 'specimen/One-file-two-readings.else', SITE / 'One-file-two-readings.else')
    for name in ['reader.mjs', 'format.mjs', 'preview.mjs', 'create.mjs']:
        shutil.copyfile(ROOT / 'web' / name, SITE / name)
    (SITE / 'vendor').mkdir(exist_ok=True)
    for name in ['pdf.mjs', 'pdf.worker.mjs', 'PDFJS-LICENSE']:
        shutil.copyfile(ROOT / 'web/vendor' / name, SITE / 'vendor' / name)
    print('Built the public specimen page in docs/.')


if __name__ == '__main__':
    main()
