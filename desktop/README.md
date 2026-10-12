# Dotelse desktop

The desktop app bundles the website reader, creator and editor with native open and save dialogs. It runs offline and uses the same unsigned two-readings profile. Ordinary PDFs can be saved unchanged, and the selected AI context can be saved as Markdown. Double-clicking a .else opens it in the application after installation.

Creation starts with one PDF and two attributed interpretations. Editing saves a copy, keeps the PDF and text derivative unchanged, and adds the earlier archive fingerprint as a declared source reference. Cancelled native saves leave the copy marked unsaved. Unsaved drafts and packages are protected when closing or replacing them.

The original-PDF drag control creates a temporary ordinary PDF copy and passes it to the desktop's native drag API. Temporary drag copies are removed when the app quits normally. Save original PDF is the keyboard-accessible alternative. A physical drop into a destination folder is distinct from the automated drag-bridge check.

No selected material is uploaded, and no remote model or background update runs. The Electron renderer is sandboxed, with Node integration disabled and context isolation enabled. A small preload bridge permits only deliberate open, save, discard confirmation and PDF drag actions. It cannot enumerate arbitrary folders. Only allowlisted bundled assets can load through the local protocol; network requests and arbitrary file URLs are blocked. Deliberate project links open in the system browser.

## Build or run from source

Use Node.js 24 or later, Python 3.9 or later, and an operating system supported by Electron 44. Install dependencies from the repository root:

```sh
npm ci
npm ci --prefix desktop
python3 desktop/build_desktop.py
npm start --prefix desktop
```

The desktop dependencies are kept in a separate package, so deploying the static website does not install Electron. The generated `desktop/app/` is ignored by Git and contains only the application UI, renderer, public specimen, icon and license. Source, test fixtures and local output are excluded from packaged apps.

Create a download on the matching platform:

```sh
cd desktop
npm run package -- --mac --universal
npm run package -- --win --x64
npm run package -- --linux --x64
```

Run only the command for that build host. The outputs are saved in `output/desktop-release/` at the repository root. macOS produces a universal ZIP for Apple silicon and Intel. Windows produces an x64 installer. Linux produces an x64 AppImage and Debian package. The current Electron runtime requires macOS 13 or later. Windows ARM and Linux ARM packages are outside this release.

Experimental downloads do not have paid publisher signing or notarization. macOS uses a local ad hoc signature; Windows has no publisher certificate. Normal operating-system checks may flag these downloads. The earlier Swift reader remains in `v0.1.0-experiment` and can still be built with the original `build.sh`.

## Verify

```sh
python3 desktop/build_desktop.py
node desktop/test_desktop.cjs
```

Linux tests require a display, for example `xvfb-run --auto-servernum node desktop/test_desktop.cjs`. The suite launches a separate app with synthetic files and a disposable profile. Native dialog answers are simulated while the real file-reading and saving handlers run. The suite covers creation, editing, cancellation, unsaved closing, exact PDF/context/package exports, independent Python read-back, launch arguments, contributor preservation, restricted privileges and rejected network access. It checks the native drag bridge without claiming a physical destination-folder drop.

To test a packaged executable, set `ELSE_DESKTOP_EXECUTABLE` to its absolute path. The GitHub workflow tests both the source app and actual packaged executable on each platform before publishing. Release artifacts are explicit packages plus SHA256SUMS.txt. No automatic updater is included.

Electron's [security guidance](https://www.electronjs.org/docs/latest/tutorial/security/) and [local protocol API](https://www.electronjs.org/docs/latest/api/protocol) describe the shell's isolation mechanisms. [electron-builder](https://www.electron.build/v26/docs/configuration/) packages the platform downloads.
