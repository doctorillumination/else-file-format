#!/usr/bin/env python3
"""Build the public specimen page using the independent Python reader."""
from pathlib import Path
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
    css = '''
    .site-nav{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:38px}.brand{display:flex;align-items:center;gap:14px;font:27px Georgia,serif}.brand img{width:52px;height:52px;border-radius:12px}.site-nav a{font-size:13px}.desktop{margin:36px 0 0;padding:28px 30px;background:#e3e6d9;border:1px solid #bdc7b2;border-radius:12px}.desktop h2{margin-top:0}.desktop .download{background:#526a4b;color:#f6f3e7;border-color:#526a4b}.platforms{font-size:13px;color:#4d6048}.platforms span{display:inline-block;margin:5px 20px 5px 0}.site-footer{font-size:12px;margin-top:26px;color:#60715e}.site-footer a{border:0;padding:0;text-decoration:underline;font-size:inherit}.note a{border:0;padding:0;text-decoration:underline;font-size:inherit}
    @media(max-width:600px){.site-nav{align-items:flex-start;flex-direction:column}.desktop{padding:22px}}
    '''
    page = page.replace('</style>', css.strip() + '</style>')
    nav = f'''<nav class="site-nav" aria-label="Project"><div class="brand"><img src="ElseIcon.png" alt="Paired cream leaves on olive green"><span>.else</span></div><a href="{REPOSITORY}">Source and format</a></nav>'''
    page = page.replace('<main><header>', '<main>' + nav + '<header>')
    page = page.replace('The inspection reader, independently decoded in Python.', 'A file, with room for the context travelling beside it.')
    page = page.replace('The PDF is embedded unchanged. The native reader also supports dragging it to Finder.', 'The PDF keeps its original bytes. Its two interpretations travel beside it. This page reads the included public specimen; opening other .else files is available in the desktop and command-line readers.')
    desktop = f'''<section class="desktop" aria-labelledby="desktop-heading"><h2 id="desktop-heading">Take the reader with you.</h2><p>Read the same specimen offline. Keep the interpretations beside the page, inspect its AI-readable context, or pull out the ordinary PDF.</p><a class="download" href="{DOWNLOAD}">Download for macOS</a><a href="One-file-two-readings.else" download>Download the .else specimen</a><p class="platforms"><span>macOS: Apple silicon and Intel</span><span>Linux: desktop app planned</span><span>Windows: desktop app planned</span></p><p class="note">Experimental macOS build, targeting macOS 14 or later. It is locally signed and has not been notarized by Apple. If your Mac blocks the download, <a href="{REPOSITORY}#build-the-macos-reader">build from source</a>. The independent Python reader can also run on Linux and Windows.</p></section><footer class="site-footer">Public, AI-authored specimen. Two readings, no human ratification. This page has no account, upload form or analytics. <a href="{REPOSITORY}/blob/main/FORMAT.md">Experimental format</a> · <a href="https://cyberdelic.space/project/cyberdelic-os/field-notes/fn-45/">Field Note 45</a> · <a href="{REPOSITORY}/blob/main/LICENSE">MIT license</a></footer>'''
    page = page.replace('</main>', desktop + '</main>')
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
    print('Built the public specimen page in docs/.')


if __name__ == '__main__':
    main()
