# Experimental contract: one PDF, two readings

Status: implemented laboratory subset, October 11, 2026. The names and versions here identify this specimen only. They do not amend the existing Dear Elsewhere or Carry formats or finalize a native Cyberdelic OS format.

## Container

Stored ZIP, UTF-8 JSON, exact included bytes. Manifest format `cyberdelic-else`, version `0.1-experimental`, profile `two-readings/0.1-experimental`. Experimental MIME bytes are `application/x-cyberdelic-else-experiment`, without a trailing newline.

```text
mimetype
manifest.json
records/<sha256>.json
blobs/sha256/<sha256>
integrity/files.json
```

All included entries except `integrity/files.json` occur in its `files` dictionary, each with exact `sha256` and integer `bytes`. The index has no self-hash. Record and blob paths independently match the hashes of their raw bytes. All three readers reject unselected records and blobs, duplicate keys and entries, missing references, unsafe paths, symlinks, unexpected capabilities and unsupported signatures.

Limits: 64 MiB archive, 32 entries, 12 MiB per entry, 256 KiB per JSON document, JSON depth 64, nonempty bounded text. This slice permits stored entries only, no ZIP comments, extra fields, descriptors, ZIP64, encryption, trailing content or overlapping entries. It uses deliberately narrower entry and feature limits than the general proposal. Local headers must agree with the central directory and entry CRC checks must pass.

The manifest has exactly `format`, `version`, `profile`, `material`, `contexts`, `requiredCapabilities` and `signatures`. There is one material record digest and exactly two distinct ordered context record digests. Capability and signature arrays are empty.

## Material

Fields: `type` (material), `title`, `filename`, `mime` (application/pdf), `pdf` (blob digest), `text` (blob digest), `source`.

`source` contains declared `kind`, `creator` and `description`. The PDF is retained byte for byte. Its text blob is an explicitly labelled extraction derivative for accessible and AI reading. The specimen writer extracts it with pypdf; the browser creator extracts selectable text locally with bundled PDF.js. Readers preserve it rather than trusting a generated summary. A hash binds each record and its included blobs, but does not prove that a supplied transcription accurately describes a different PDF. The sample's extracted text is also checked against the specimen PDF during verification.

Only a safe original basename ending in `.pdf` is accepted. It contains no path separators, colon, control characters or parent-directory traversal and is at most 180 characters. Internal blob paths never become export destinations.

## Interpretation

Fields: `type` (context), `title`, `target` (the exact material record digest), `author`, `status` (demonstration), `text` (UTF-8 blob digest).

`author` contains `kind` (ai or human), `name`, `role` and `generator`. The actual specimen uses AI-labelled authors for both readings. These are separate context records targeting the same material, not changes to the PDF. Unknown fields fail in this closed subset rather than being silently serialized into exports.

## Local creation

The website accepts one dropped or selected PDF and requires declared source information plus exactly two attributed interpretations. It retains the selected PDF byte for byte, builds content-addressed material, text and context records, then writes a stored ZIP with CRC checks and an exact integrity index. It validates the finished archive with the browser reader before downloading it. No upload, source-link fetch, model call or persistent browser storage is involved.

Creation uses the same `two-readings/0.1-experimental` contract, including its wire status `demonstration`. That status identifies an experimental contribution, not a claim about whether its declared contributor is a person or a machine. Human contributions use `kind: human` and `generator: Not applicable (human-written)`; AI contributions require a declared tool or model. Current reader sources distinguish human contributions from unratified AI demonstrations in the context projection. The original released desktop binary accepts both kinds with its earlier general demonstration wording.

PDF creation is bounded at 12 MiB, 200 pages and 65,536 extracted text characters. No OCR or summarization occurs. If no selectable text exists, the text blob explicitly says that extraction is unavailable, and the source description records the limitation. Password-protected or unparseable PDFs fail before replacing the current view or draft. The original file is never rewritten. Interpretation text, including its leading whitespace and line breaks, is preserved as entered.

Source descriptions append a clearly labelled extraction-method notice. A source URL is declared text, not fetched content or a verified source identity. ZIP timestamps use a fixed 1980 date solely for container compatibility; they are not provenance timestamps. Creation does not add a signature, delivery record, social history or ratification. Saved files reopen in all three independent readers. Editing and merging an existing package remain future work.

## Readers and AI projection

The Swift reader independently parses stored ZIP bytes, rejects duplicate JSON members, checks CRC and SHA-256, validates the graph and presents the PDF in a native window. The Python reader independently uses its standard-library ZIP parser with additional structural constraints, duplicate-key rejection, CRC and SHA-256 verification and graph validation. It produces a self-contained browser report.

The website's JavaScript reader independently parses the stored ZIP, rejects duplicate JSON members including escaped duplicate names, checks CRC and Web Crypto SHA-256, and validates the same selected graph. A file is read through the browser's local File API; no upload endpoint is used. The shared malformed fixtures and a changed Unicode specimen are checked against all three implementations.

All three generate the same selected Markdown context from validated records. The context identifies source words, contributors, generator, input and target digests, demonstration status, included scope and evidence limits. It is task data and cannot authorize tools or further access. It is generated outside the package, never trusted as an embedded authoritative summary.

The website renders imported text with DOM text nodes, and draws PDF bytes using a bundled PDF.js worker with no active document scripts, links or forms. PDF and context downloads use in-memory blob URLs. Browser networking for application connections is disabled by Content Security Policy. Automated browser tests open and export a changed package while offline and observe zero HTTP requests during local use. The file view is discarded on reload; no persistent browser storage is used.

## Ordinary extraction

The exported PDF is exactly its blob bytes. Surrounding context, source declarations and integrity records are not injected into the PDF or required as sidecars. Native drag uses a temporary ordinary copy and advertises a copy operation to Finder. Temporary copies remain available after the drag or open action; if one has been externally edited, the reader offers Save original rather than silently replacing it. The application does not watch or synchronize external edits.

The independent command-line extractor refuses replacement. Native Save original uses a system save panel and writes only after an explicit destination and any replacement choice. No export creates a Carry event, receipt, arrival or listening record. An unchanged package remains available after extraction.

## Deliberate omissions

No keys, signatures, encryption, transport, remote fetching, upstream social history, permission service, private notes, recipient identity, editing, merging or automated AI invocation. Authorship and source labels remain declarations. This file cannot retract copies or enforce who later opens an extracted ordinary PDF.
