# Specimen 01 verification

Date: October 11, 2026. Local macOS build, not a production security audit.

## Verified

- Native app builds with the installed Apple developer tools and its local ad hoc signature verifies.
- The Swift, Python and JavaScript readers independently recover the same material, two attributed interpretations, source description and integrity status.
- All three independently generate identical selected AI-readable context.
- PDFKit independently reads the one-page PDF and confirms that its extracted words match the source-text derivative.
- Exact-byte extraction works through all three command-line reader interfaces. Existing destinations are not silently replaced and external edits leave the `.else` unchanged.
- Native Save original was exercised through its real save panel. Its output matches the PDF blob and original source file byte for byte.
- The independent browser reader was visually inspected through a loopback preview restricted to this public specimen. Its original-PDF download also matches the original bytes. The saved offline HTML contains the same independently decoded model.
- The native AI-context panel was opened and checked for source words, both readings, attribution, exact references, included scope and evidence limits.
- Automated malformed, unsupported and private-content fixtures are rejected by all three readers. The bundled offline report also matches the Python reader exactly. See `output/checks.json` for all 27 checks, including browser-writer compatibility and nine invalid creation inputs.
- The standalone implementation was developed without editing Dear Elsewhere or Carry implementation files. A local fingerprint comparison confirmed this boundary before publication. Private workspace inventories are not included in this public repository.

## Drag verification boundary

The native card creates an ordinary exact-byte PDF copy and starts a standard AppKit file-URL copy drag. It accepts the initial mouse gesture when the reader is in the background. The desktop test produced a completed copy operation from AppKit, but the automation did not establish a PDF in the intended Finder folder. The final Finder destination still needs a direct manual check. Native Save original and the browser download are independently verified alternatives.

The drag status indicates completion of a local desktop gesture only. It does not create a Carry event or assert delivery to another person. The package remains read-only throughout.

## Deliberate scope

The public specimen is one PDF with two AI-labelled demonstration readings. The standalone Swift and Python readers are joined by an independent browser reader and local creator. Creation accepts a PDF, source declarations and two human or AI interpretations. It includes no live model call, signatures, encryption, voice notes, real social journey, app integration or production format release.

## Public distribution

The app's icon follows Carry's olive and cream palette with a distinct paired-leaf mark. The build includes a native icon resource and explicitly targets macOS 14. A universal build includes arm64 and x86_64 executable slices. Ad hoc signing is a local integrity check; this distribution has not been notarized by Apple.

The static website includes a local JavaScript importer for the standalone two-readings profile. Linux and Windows desktop packaging remain planned. The command-line Python reader is portable code, but no Linux or Windows desktop app is claimed as tested or released.

## Local browser import

The reader checks cover drag-in of a changed package, literal rendering of untrusted HTML-shaped text, a local PDF preview, keyboard file selection, exact PDF, context and .else downloads, rejection of unselected and truncated content, the latest-file choice winning a loading race, clearing on reload and narrow-screen layout. See `output/browser-checks.json`.

After loading the page, the test disconnects the browser from the network. Opening, previewing, rejecting and exporting files all succeed with zero HTTP requests during local use. Downloaded PDF bytes equal the original; the context equals the independent Python projection. The selected `.else` is unchanged. Test fixtures are synthetic and include no private app data.

The browser accepts this experiment's bounded profile only. A failed PDF preview leaves the validated source and context available for export. The PDF preview library's separate license and provenance are recorded in `THIRD_PARTY.md`.

## Local browser creation

The browser suite now has 13 checks. It creates and downloads a .else while offline from a synthetic two-page PDF, declared source information and one human plus one AI interpretation. Python independently parses the actual browser download and produces identical AI context; the local test also checks the Swift reader. Cross-reader tests on both Mac architectures independently validate a JavaScript-writer fixture. The public profile is unchanged.

The saved .else reopens in the browser, previews both pages and exports a PDF exactly equal to the input plus context exactly equal to the independent projection. The draft also permits immediate exact-byte PDF export. Source URLs and HTML-shaped notes remain literal text. Notes retain leading whitespace and line breaks. An invalid creation leaves the draft intact, AI-labelled notes require a generator name, and cancelling returns to the prior valid view.

A synthetic PDF without selectable text is carried unchanged with a clear extraction limitation. Confirmed reloading clears an unsaved draft and the local file view. The creation form fits a narrow mobile viewport. Reading, extracting PDF text, creating, previewing and downloading all run with zero HTTP requests after initial page load. The tests use a fresh browser profile and synthetic files, not private app content. Creation is a website feature; the released desktop application remains a reader.

## Website and local editing

The current browser suite has 18 checks. The landing page opens the public sample only when requested. Editing preloads both interpretations, roles, contributor kinds, generators and the source declaration. Cancelling returns to the validated original. Saving downloads a new .else that independently opens in Python and the local Swift reader, with matching AI context. Both interpretations target the new material record; its source description contains the exact prior archive fingerprint. The original package on disk is unchanged, and the edited PDF and text derivative retain the original bytes.

Clipboard export matches the independent AI projection in the isolated test profile. Unsaved work is protected when closing, leaving or replacing a draft. Confirmed closing clears the model, text, form and PDF canvas. Editing and these exports also work offline, with zero application HTTP requests. The home and editor layouts were visually inspected. Cloudflare configuration publishes only the public docs directory.

Wrangler 4.149.0 completed a local deployment dry-run, reading 16 files from docs and excluding the source tree, test tooling and local output. This checks the optional Workers configuration. Production is hosted separately by Cloudflare Pages.

## Live custom domain

Cloudflare Pages deployed commit `88ce83b` from `main`. Its GitHub connection has automatic production deployments enabled. `dotelse.app` is active with SSL enabled, and the site was opened successfully in Chrome at `https://dotelse.app/`.

The live site's public sample was edited and saved as a new .else. Python and Swift independently recovered the same edited model and AI context. The original PDF and source-text derivative were unchanged, the second interpretation and contributor attribution were retained, and the source description included the prior archive's exact SHA-256 fingerprint. This remains an unsigned textual revision reference, not signed lineage.

The original PDF and AI context were downloaded from the actual custom-domain reader controls. The PDF matched the original bytes, with SHA-256 `929563e826f1f56ab210fdf4cd0f62418f9ef1e921025b33c70b8e595a0bcff2`. The downloaded Markdown matched the independent Python and Swift context exactly. All 14 publicly served files matched committed `docs/` bytes over HTTPS with certificate verification enabled. The live response contained the expected content policy, privacy headers and cache revalidation.

Local evidence is saved in `output/Dotelse-live-download-verification.json`, `output/Dotelse-live-assets-verification.json` and `output/Dotelse-app-live.png`. These checks complement the 27 format checks and 18 isolated browser checks; the local test evidence is not part of the published site.

## Desktop authoring, October 12, 2026

Dotelse 0.2 bundles the existing JavaScript reader, writer, editor and PDF renderer in an offline desktop shell. The two-readings wire profile is unchanged. The earlier Swift macOS reader is preserved in its original release and source files; Dear Elsewhere and Carry code was not changed.

The desktop suite has 11 integration checks. It opens a .else through a launch argument, creates from a synthetic two-page PDF, saves an edited copy, and independently checks the actual written file and context with Python. Original PDF bytes, text derivatives, the second interpretation and contributor attribution are retained. Revision references contain the exact earlier archive fingerprint, while input files remain unchanged.

Native-dialog responses are simulated in the automated suite while the real read and write handlers run. Cancelling a save keeps the new package marked unsaved. Closing or replacing unsaved work is protected. Editing cancellation restores the validated original. PDF, Markdown and .else exports match their selected bytes exactly. Unselected private content is rejected without replacing the open file.

The suite checks renderer sandboxing, context isolation, disabled Node access, the small preload bridge, rejected network requests, blocked arbitrary file URLs, allowlisted bundled assets and safe export names. The PDF drag bridge hands an exact ordinary PDF copy to the native drag API. A physical destination-folder drop is not claimed by that automated check.

Source and packaged application checks passed on Windows x64, Linux x64 and Apple silicon macOS. The actual universal Mac ZIP was also extracted, signature-checked and exercised on an Intel Mac. Both executable architectures were verified. The [platform build record](https://github.com/doctorillumination/else-file-format/actions/runs/38276676926) contains the first complete pass; the release workflow repeats the checks for its exact tag before publishing.

The packaged Mac app was separately operated through its real interface and native macOS dialogs. Its edited .else, original PDF and AI context were saved to local verification output. Python and the original Swift reader independently matched the edited model and context. The PDF SHA-256 remains `929563e826f1f56ab210fdf4cd0f62418f9ef1e921025b33c70b8e595a0bcff2`. Evidence is in `output/Desktop-native-verification.json` and `output/Desktop-native-proof.png`.

The 27 format checks and 18 browser checks still pass after the shared reader changes. Platform package execution and automated checks are distinct from manual installation on arbitrary Windows or Linux machines. macOS distribution is ad hoc signed, without Apple notarization; the Windows installer has no publisher certificate. Release fingerprints are byte-integrity records, not identity signatures.

The [exact tagged build](https://github.com/doctorillumination/else-file-format/actions/runs/38277546064) passed all four platform jobs at commit `28cee19318e3362f8f400256f8523d48e2c9385e`. Its initial publication step rejected incorrect Linux filename assumptions. The corrected publisher reused those unchanged tested artifacts, first verifying the source build against the existing tag and each passing platform job. The [publication run](https://github.com/doctorillumination/else-file-format/actions/runs/38278860106) succeeded.

[Release v0.2.0-experiment](https://github.com/doctorillumination/else-file-format/releases/tag/v0.2.0-experiment) contains the universal Mac ZIP, Windows x64 installer, Linux x86_64 AppImage, Linux amd64 Debian package and SHA256SUMS.txt. All four packages are public and uploaded. Their GitHub asset SHA-256 digests match the downloaded fingerprint file. Local read-back evidence is in `output/release-public-verification/verified.json`.

## Visual mixed reader, October 13, 2026

Chromium and WebKit passed local creation, actual audio playback, full-screen PDF paging, retained-frame video expansion, exact original PDF/audio exports, matching selected AI context, and offline editing with earlier public proofs preserved. Those checks deliberately block remote providers and exercise saved fallbacks. The strict JavaScript and independent Python validators still reject altered signatures and unselected private content. Branch and merge preservation passes.

The Electron app passed native creation, cancelled-save protection and exact original extraction. The separate legacy desktop suite passed all 10 checks, including its bounded native drag bridge. The legacy browser suite passed all 18 checks. Source-boundary checks reject archive paths on the source hostname, reject uploads, keep the desktop root offline, and allow HTTPS only from isolated source descendants. These local checks are distinct from production source-domain configuration and live-provider verification.

Carry's unchanged core passed 50 tests. Native simulator checks passed visual reading, waveform play/pause, PDF expansion, selected AI-context sharing, signed edition/response preservation, separate source navigation and existing PDF reading. A live simulator check played the YouTube passage and opened the X post. The final physical iPhone and TestFlight checks are recorded in Carry's release documentation once completed.

The browser video controls use the official YouTube player API in the isolated source view, with ready and playback-state messages authenticated against the frame, origin and a random nonce. A player is paused only after playback has been observed. Carry's equivalent ready guard passed another live simulator check.

The source hostname is configured on the existing Pages project. HTTPS read-back serves both embed views, rejects reader and archive paths with 404, and rejects uploads on both hostnames with 405. A live headed browser and the desktop application displayed the actual X post, observed YouTube playback, expanded and closed the retained player, and played the original voice. These checks use public references and the public sample. The 0.4.1 controls and loading-space fix passed the mixed Chromium, WebKit and desktop suite, including a new desktop PDF/video expansion and Escape regression. The physical iPhone TestFlight installation remains a separate acceptance gate.
