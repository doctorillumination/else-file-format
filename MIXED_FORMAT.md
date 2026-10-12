# Mixed material experiment

Implemented experimental profile: `mixed-material/0.1-experimental`. Family `cyberdelic-else`, version `0.1-experimental`, MIME `application/vnd.cyberdelic.else+zip`, extension `.else`. This profile is distinct from the preserved two-readings, Carry file-sharing, shared-document and Dear Elsewhere profiles.

The object separates source material, attributed context, ordered composition and public commitments. Collecting, editing, signing, extraction and addressed delivery remain different actions. No account, public tracking service or universal reputation is required.

## Container

Stored ZIP, exact original bytes and readable UTF-8 JSON:

```text
mimetype
manifest.json
integrity/files.json
materials/<sha256>.json
contexts/<sha256>.json
editions/<sha256>.json
proofs/<sha256>.json
blobs/sha256/<sha256>
```

Record and blob names bind their raw bytes. The integrity index covers every entry except itself, with exact byte counts and SHA-256. Limits: 64 MiB archive, 128 entries, 12 MiB blobs, 256 KiB JSON/text entries, 12 materials and 32 contexts per edition, 16 retained editions and 32 proofs. These are pilot resource bounds. Exports fail rather than silently trim history.

ZIP comments, extra fields, descriptors, compression, encryption, ZIP64, duplicate names, symlinks, unsafe names, trailing content and overlaps are refused. Local headers, directory and CRCs must agree. Manifest fields are exactly `format`, `version`, `profile`, `heads` and `proofs`. Records have closed schemas, with explicit nulls for nullable fields. Unselected records and blobs are refused. Routing uses the manifest.

## Records

Material fields: `kind title creator url filename mime blob excerpt method start end`.

- PDF includes unchanged original bytes and optional extracted text with its method. Creator/source information remains declared.
- Social includes an HTTPS reference, attribution and optional supplied excerpt. The full post is not claimed to be included.
- YouTube includes a canonical watch URL, validated 11-character ID, integer start/end seconds and optional supplied passage text. No video stream is included.

Context fields: `author material base text audio filename mime transcript transcriptMethod status`. Author fields: `kind name generator`. Context targets a material or the whole composition. A response names its exact base edition. Audio and transcript are separate, with the transcription method labelled. Human names are declarations; AI contributions require a generator and remain proposals. Composers check playable audio and the two-minute limit; archive admission binds its bytes and MIME without certifying universal codec support.

Edition fields: `bundleID title materials contexts parents editor declaredAt`. The bundle UUID stays stable. Ordered material/context references are content digests. Sources and previous contributions remain immutable. Changes produce new records and editions. Complete referenced ancestry stays included. Missing ancestors, cycles, mixed identities and incorrect graph heads are refused. Concurrent branches are preserved. The codec supports a deliberate two-parent merge; interfaces expose history and responding to a chosen edition.

Titles/source declarations are bounded to 1,200 UTF-8 bytes, names to 240, source URLs to 8,192 and safe basenames to 180. Dates are declarations, not trusted time. Saving is not a delivery receipt. This object does not replace Carry's addressed carry/receipt or shared-document membership contracts.

## Exact public proofs

Keys remain in Carry's device-only Keychain. Web and desktop verify public proofs and create unsigned descendants. Editing never inherits an earlier signature.

Proof profile `else-mixed-proof/1`, purposes `edition` and `response`. Signed input:

```text
UTF8("else-mixed-proof/1" + NUL + purpose + NUL + bundleID + NUL + publicKeyBase64 + NUL) || exactBodyBytes
```

The proof ID is SHA-256 of that input; Ed25519 signs the same bytes. Wrapper fields: `profile purpose bundleID publicKey body signature id`. Body/signature use canonical padded base64. Body fields: `bundleID edition context signer`; signer has UUID and declared name. Response proofs bind a human-labelled context whose name matches the signer and whose base is preserved. Edition proofs have a null context. Container proof filenames use SHA-256 of their complete raw wrapper, distinct from the domain commitment ID.

Readers verify exact body bytes without JSON reserialization. Domains remain separate from existing Carry/document proofs. A signature establishes key possession and commitment integrity, not truth, ownership, voice identity or permission. Carry marks locally confirmed People keys; browser/desktop do not claim human confirmation. Unsupported browser Ed25519 implementations show their limitation.

Files remain unencrypted. Anyone with a copy can read it; copies cannot be recalled. No Nostr or blockchain compatibility is claimed.

## Interaction and privacy

Opening, composition, PDF reading, voice playback and extraction are local. Browser drafts stay in tab memory, without persistent storage, uploads, model calls or background source fetches. Native bridges are bounded. Carry collects without creating a Carry event. Invalid mixed imports retain an original recovery copy.

Live viewing is deliberate and separate. Browser references travel in URL fragments to an opener-free source window, keeping them out of application HTTP request URLs. Desktop uses a separate nonpersistent session without a preload/filesystem bridge. Carry uses its nonpersistent source reader. Providers control availability and may deny embedding or require login. Instagram remains a reference with an original-page link. Live views never replace saved text or become claimed signed content.

Ordinary PDF/voice exports preserve exact included bytes with normal filenames and no required sidecar. AI Markdown is regenerated from validated selected records, marks missing content and derivative methods, and includes the selected edition's relevant proofs. It cannot authorize tools or private archive access. Other branches or later unselected editions are not silently added.

## Verification

JavaScript and Swift validate independently. `mixed_reader.py` verifies ZIP structure, graph, references and Ed25519 using OpenSSL 3. `web/test_mixed.mjs` runs real Chromium/WebKit and Electron creation, playback, extraction, cancellation, signed imports and offline edits. Carry core and simulator UI suites cover native validation, Keychain signing, responses and desktop returns. Public signed specimens use synthetic contributors and ephemeral fixture keys.
