<img src="assets/ElseIcon.png" width="96" alt="The .else paired-leaf icon">

# .else

A file, with room for its context.

`.else` is an experiment in a native Cyberdelic OS file format: ordinary material can travel with attributed interpretations, source information and selected context. The material keeps its own life. A PDF can leave the package again as an ordinary, unchanged PDF.

This first standalone experiment contains **one PDF, two interpretations and two independent readers**. It explores a practical Carry-like reading and a Dear Elsewhere-like encounter reading. It changes neither application and does not replace their existing `.else` formats.

The website adds a third independent reader in JavaScript and a local creator, using the same bounded format and the same selected AI context.

## Try the experiment

- [Read the public specimen in your browser](https://doctorillumination.github.io/else-file-format/).
- [Download the experimental macOS reader](https://github.com/doctorillumination/else-file-format/releases/download/v0.1.0-experiment/Else-Experiment-macOS-universal.zip).
- [Download the specimen](specimen/One-file-two-readings.else) or [inspect the format](FORMAT.md).

The macOS download contains Apple silicon and Intel builds targeting macOS 14 or later. It is ad hoc signed and has not been notarized by Apple. Gatekeeper may block a downloaded build. Building from source is also available below.

On the website, drag a `.else` file onto the page or choose **Choose PDF or .else file**. A supported file opens entirely on your device. Choose **Save original PDF**, **Save AI context** or **Save .else** to export without changing the package. The PDF remains an ordinary, exact-byte PDF.

To create a file, drop one PDF. Add a title, its original creator and where it came from, then add two interpretations with contributor names. Each interpretation is explicitly labelled human or AI; machine-written words also require a tool or model name. Choose **Save .else locally** to download the package and open it in the reader. The original PDF can be saved directly from the draft or pulled out of the finished file.

Creation supports PDFs up to 12 MiB and 200 pages, with up to 65,536 characters of selectable text. Text is extracted locally with bundled PDF.js for the AI view, without OCR or summarization. A PDF with no selectable text is carried unchanged, with an explicit unavailable-text notice. Password-protected PDFs are unsupported. Source links remain text and are never fetched. The file uses the existing unsigned experimental profile, so the native and Python readers can open it too. Creation currently lives in the website; the desktop app remains a reader.

The browser validates the archive, references, hashes and selected records before replacing the view. It accepts the standalone `two-readings/0.1-experimental` profile, up to 64 MiB; other Dear Elsewhere or Carry formats remain separate. An invalid file leaves the previous valid file open with a clear error.

Once the page has loaded, opening, text extraction, creation, PDF preview and all exports work offline. Selected bytes and unsaved drafts stay in tab memory. The reader performs no upload, AI call, background storage or tracking. Reloading returns to the public specimen and clears the draft. The PDF preview uses a bundled local renderer, with no active document scripts or forms; see [third-party attribution](THIRD_PARTY.md).

Linux and Windows desktop apps are planned. The independent Python command-line reader already uses only the standard library, making it portable across those systems. Desktop packaging and platform verification remain separate work.

## In the macOS reader

1. Open **Else Experiment.app**. The sample loads automatically.
2. Read the PDF and both interpretations beside it.
3. Drag the green **Drag the original PDF out** card to a Finder folder, or choose **Save original PDF**. The exported file contains the exact original PDF bytes, without context injected into it.
4. Choose **Open PDF** to use a temporary ordinary copy in your default PDF application.
5. Choose **AI context** to inspect or save the source text, attribution, references and evidence limits.
6. Choose **Inspection reader** to open a self-contained browser report, independently decoded by Python. The default sample report is included in the app, so trying it does not require a separate Python installation. Generating a report for another package requires Python 3.

The PDF and both interpretations are AI-authored demonstration material, not words attributed to Bradley or Jason and not ratified Kernel text. No AI service is called automatically. The app does not register itself as the system's default `.else` handler.

Native Save original and browser download have been verified byte for byte. The AppKit drag starts a copy operation, but the final Finder destination still needs a direct manual check. See [verification](VERIFICATION.md).

## Build the macOS reader

Requirements: macOS, Apple command line developer tools with Swift 5.9 or newer, and Python 3.9 or newer. The app uses AppKit, PDFKit and CryptoKit. The Python reader has no third-party dependencies.

```sh
git clone https://github.com/doctorillumination/else-file-format.git
cd else-file-format
zsh build.sh
open 'output/Else Experiment.app'
```

To include both Mac architectures:

```sh
zsh build.sh --universal
```

The build generates the desktop icon from the included [source artwork](assets/ElseIcon.png). GitHub Actions builds both architectures and runs the cross-reader checks on two macOS runners.

Cross-reader verification also requires Node.js 20 or later:

```sh
python3 test_experiment.py
```

## Use the independent reader

```sh
python3 reader.py specimen/One-file-two-readings.else
python3 reader.py specimen/One-file-two-readings.else --extract original.pdf
python3 reader.py specimen/One-file-two-readings.else --context context.md --html reader.html
```

Choose fresh export destinations. This reader refuses to overwrite an existing file. Native Save original uses a system save panel's explicit replacement choice.

The native implementation also exposes inspection and export commands:

```sh
'output/Else Experiment.app/Contents/MacOS/ElseExperiment' --inspect specimen/One-file-two-readings.else
'output/Else Experiment.app/Contents/MacOS/ElseExperiment' --context specimen/One-file-two-readings.else
'output/Else Experiment.app/Contents/MacOS/ElseExperiment' --extract specimen/One-file-two-readings.else original.pdf
```

## Preview and rebuild the website

For a loopback preview limited to the public specimen:

```sh
python3 preview.py
```

Open `http://127.0.0.1:8784/`. The preview has no directory listing or general filesystem routes.

`python3 build_site.py` regenerates the static website in `docs/`. GitHub Pages serves this directory. The default sample is embedded, while chosen files are decoded locally by JavaScript. The bundled PDF renderer and worker load with the page. No server-side Python, account, analytics, external CDN or remote PDF fetch is needed.

To run the isolated browser checks, with Node.js 20 or later:

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

These tests use synthetic packages and a fresh browser profile. They exercise drag-in, keyboard file selection, PDF creation, human and AI attribution, text extraction, exact downloads, independent reader round-trips, rejected content, overlapping file choices, clearing drafts on reload, narrow layouts and zero HTTP requests during local file use. Test tooling is not required to use the website.

## Recreate the sample

Only the fixture writer needs third-party PDF libraries. These are not required for reading, exporting or building the macOS app.

```sh
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements-specimen.txt
python3 make_specimen.py
python3 build_site.py
```

The writer creates deliberately public material in `specimen/`. It does not read app stores, private notes, identity keys or collecting history.

## What the experiment establishes

The Swift, Python and JavaScript implementations recover the same source, interpretations and selected AI context. Content hashes bind the included bytes to their records. Extraction leaves the package unchanged, and editing an external PDF copy does not silently alter the `.else`.

The package is unsigned and unencrypted. Creator labels are declarations; hashes do not authenticate identity, consent or authorship. This is an experimental parser, not a production security audit. See the [bounded wire contract](FORMAT.md) and [verification record](VERIFICATION.md).

The AI projection is selected task data. It includes source words, contributor roles, input and target references, status and disclosed omissions. It cannot grant an AI access to other files or authorize actions. Source material, attributed interpretation and future machine proposals remain distinct.

## The next experiment

The website provides local reading and creation across desktop platforms. Future work can broaden the accepted profiles, material types and accessibility of PDF previews. Linux and Windows desktop packages would add native drag-out, offline file opening and file associations.

Future collaboration can add written or spoken responses, with each contribution linked to its input revision and kept distinct from the source. Signatures, transport, live AI participation, revision merging, Carry events and Dear Elsewhere arrivals require their own experiments and human decisions. None is represented as implemented here.

## Background and license

[Field Note 45, The File Is a Score](https://cyberdelic.space/project/cyberdelic-os/field-notes/fn-45/) describes the artistic direction. This repository makes a small, inspectable technical response to it.

The app's drag gesture uses [AppKit dragging sessions](https://developer.apple.com/documentation/appkit/nsview/begindraggingsession(with:event:source:)) and displays the original with [PDFKit](https://developer.apple.com/documentation/pdfkit/pdfview).

[MIT license](LICENSE) for the experiment. The public specimen and generated icon are included. Bundled PDF.js retains its [Apache 2.0 license](THIRD_PARTY.md).
