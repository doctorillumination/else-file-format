# Bundled PDF preview

The website and desktop app bundle Mozilla PDF.js 6.4.299 from the official `pdfjs-dist` npm distribution. The modules in `web/vendor/` are unmodified upstream `build/pdf.min.mjs` and `build/pdf.worker.min.mjs`, renamed to `pdf.mjs` and `pdf.worker.mjs`. Their Apache 2.0 license is preserved in `web/vendor/PDFJS-LICENSE` and in the published website's `vendor/` directory. The public package is available at `https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz`.

PDF.js draws the validated original bytes into a canvas on the person's device. The application supplies bytes directly, uses a worker loaded with the page, disables worker fetching and WebAssembly helpers, supplies no remote resource URLs, and displays no interactive document scripts, links or forms. Export still returns the exact original PDF bytes.

The `.else` validator, context projection and surrounding application code use the project's MIT license. No external CDN or AI service is used.

## Desktop runtime and packaging

Dotelse bundles Electron 44.7.0 from the official npm distribution, with its MIT license and Chromium third-party notices included in the platform packages. Electron is the desktop shell; it loads only the bundled app and blocks outgoing application requests.

Platform downloads are generated with electron-builder 26.17.0, under its MIT license. It is a build-time dependency, kept in the separate desktop package and lockfile. Node.js, Electron and desktop packaging tools are not installed by the static website build.
