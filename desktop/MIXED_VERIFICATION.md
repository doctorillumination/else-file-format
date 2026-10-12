# Mixed exchange verification

October 12, 2026. Experimental local transfer. Observed development and release tests:

- JavaScript, Swift and independent Python/OpenSSL agree on unsigned, signed, response and native-created files, with identical selected AI Markdown.
- Chromium and WebKit create files, play PCM WAV, extract exact PDF/voice bytes and edit offline with zero HTTP requests, retaining signed ancestors.
- macOS Electron creates the same profile, imports signed files, protects cancelled saves and extracts exact originals.
- Two dedicated iOS 27 simulators use different device Keychain identities. The first reads the PDF/voice and signs an edition and response. The second imports the file, adds its own signed response and relaunches with its identity retained.
- The actual two-phone export opens in browser and macOS. A desktop edit returns to the first simulator with earlier proofs and sources retained.
- Three validators reject altered signatures behind recomputed integrity and unselected private-content fixtures. The 50 Carry core checks and 27 preserved original-profile checks passed during development.
- The actual macOS universal package passes mixed creation, signed imports, cancellation, PDF/voice extraction and the 11 preserved desktop checks. Its executable contains both Apple silicon and Intel architectures, and its local ad hoc signature verifies.
- Release CI [38305884290](https://github.com/doctorillumination/else-file-format/actions/runs/38305884290) passed on Apple silicon macOS, Intel macOS, Windows x64 and Linux x64. The public [0.3.0 experimental release](https://github.com/doctorillumination/else-file-format/releases/tag/v0.3.0-experiment) contains the universal macOS ZIP, Windows installer, Linux AppImage and Debian package, with checksums.
- Live YouTube playback and the X post display were observed in the browser. A separate signed iOS simulator UI test opened both live sources successfully. These provider views are deliberate, isolated from the local package, and remain dependent on provider availability.
- The production [mixed reader](https://dotelse.app/mixed) opens the actual two-simulator export locally, showing both public keys and all three valid signatures. The website and desktop edits remain unsigned descendants of the original phone commitments.

Evidence resides in ignored `output/mixed-checks` and Carry `build-mixed/*.xcresult` bundles. Synthetic data and dedicated devices preserve existing Bags. No private key was exported, committed or supplied to a renderer.

The native desktop drag bridge was checked with the exact original PDF bytes. A manual drop into a Finder folder has not been observed. These phone results are simulator results; physical iPhone sharing and AirDrop remain untested. Saved references/context survive denied embeds. Instagram is an original-page reference, and YouTube video bytes are not bundled for offline playback. Files remain unencrypted. A valid signature confirms a key's commitment, not a person's identity, source truth or permission.

Reproduce using compatible Node/Python, Playwright Chromium/WebKit, OpenSSL 3 and Xcode:

```sh
python3 browser_fixtures.py
node web/mixed-fixture.mjs
../Carry/.build/debug/carry-tool mixed-exchange output/mixed-checks
python3 build_site.py
python3 desktop/build_desktop.py
node web/test_mixed.mjs
```

`ELSE_CARRY_TOOL` enables Swift verification, `ELSE_PYTHON` selects compatible Python and `ELSE_PHONE_FILE` includes a public two-simulator export. CI uses the checked-in synthetic signed specimen when Xcode is unavailable. Correctly signed simulator bundles are required for the real Keychain tests.
