#!/usr/bin/env python3
"""Loopback preview of the public specimen only, with no filesystem routes."""
import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
import re
from reader import read_package, ai_context
from build_site import site_page

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--port', type=int, default=8784)
args = parser.parse_args()
model, pdf = read_package(ROOT / 'specimen/One-file-two-readings.else')
page_text = site_page(model, pdf)
page_text = re.sub(r'href="data:application/pdf;base64,[^"]+"', 'href="/original.pdf"', page_text)
page_text = re.sub(r'href="data:text/markdown;charset=utf-8;base64,[^"]+"', 'href="/context.md"', page_text)
page = page_text.encode()
resources = {
    '/': (page, 'text/html; charset=utf-8', None),
    '/original.pdf': (pdf, 'application/pdf', model['filename']),
    '/context.md': (ai_context(model).encode(), 'text/markdown; charset=utf-8', 'context.md'),
    '/ElseIcon.png': ((ROOT / 'assets/ElseIcon.png').read_bytes(), 'image/png', None),
    '/One-file-two-readings.else': ((ROOT / 'specimen/One-file-two-readings.else').read_bytes(), 'application/x-cyberdelic-else-experiment', 'One-file-two-readings.else'),
    '/reader.mjs': ((ROOT / 'web/reader.mjs').read_bytes(), 'text/javascript; charset=utf-8', None),
    '/format.mjs': ((ROOT / 'web/format.mjs').read_bytes(), 'text/javascript; charset=utf-8', None),
    '/preview.mjs': ((ROOT / 'web/preview.mjs').read_bytes(), 'text/javascript; charset=utf-8', None),
    '/create.mjs': ((ROOT / 'web/create.mjs').read_bytes(), 'text/javascript; charset=utf-8', None),
    '/vendor/pdf.mjs': ((ROOT / 'web/vendor/pdf.mjs').read_bytes(), 'text/javascript; charset=utf-8', None),
    '/vendor/pdf.worker.mjs': ((ROOT / 'web/vendor/pdf.worker.mjs').read_bytes(), 'text/javascript; charset=utf-8', None)
}


class Preview(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.headers.get('Host') != f'127.0.0.1:{args.port}' or self.path not in resources:
            self.send_error(404)
            return
        self.send_response(200)
        body, mime, filename = resources[self.path]
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        if filename:
            self.send_header('Content-Disposition', 'attachment; filename="' + filename + '"')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_):
        pass


print(f'Public specimen preview: http://127.0.0.1:{args.port}/', flush=True)
HTTPServer(('127.0.0.1', args.port), Preview).serve_forever()
