# Mixed exchange verification

October 12, 2026. Experimental local transfer. Observed development tests:

- JavaScript, Swift and independent Python/OpenSSL agree on unsigned, signed, response and native-created files, with identical selected AI Markdown.
- Chromium and WebKit create files, play PCM WAV, extract exact PDF/voice bytes and edit offline with zero HTTP requests, retaining signed ancestors.
- macOS Electron creates the same profile, imports signed files, protects cancelled saves and extracts exact originals.
- Two dedicated iOS 27 simulators use different device Keychain identities. The first reads the PDF/voice and signs an edition and response. The second imports the file, adds its own signed response and relaunches with its identity retained.
- The actual two-phone export opens in browser and macOS. A desktop edit returns to the first simulator with earlier proofs and sources retained.
- Three validators reject altered signatures behind recomputed integrity and unselected private-content fixtures. The 50 Carry core checks and 27 preserved original-profile checks passed during development.

Evidence resides in ignored `output/mixed-checks` and Carry `build-mixed/*.xcresult` bundles. Synthetic data and dedicated devices preserve existing Bags. No private key was exported, committed or supplied to a renderer.

Live provider behavior, packaged binaries and ordinary drag completion have separate evidence. These phone results are simulator results, not a physical iPhone or AirDrop test. Saved references/context survive denied embeds.

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
