# Desktop authoring experiment

The desktop application bundles the existing JavaScript reader, writer, editor and PDF renderer. The website and desktop app continue to use `two-readings/0.1-experimental`: one unchanged PDF, its text derivative, declared source information and two attributed interpretations. Dear Elsewhere and Carry remain separate applications.

The desktop shell adds operating-system file selection, save dialogs, .else file associations and an original-PDF drag gesture. A sandboxed renderer receives only deliberately opened bytes. Its small isolated bridge cannot browse arbitrary paths, run commands or access a network service. Bundled assets are served through an allowlisted local protocol. Outgoing requests are blocked; deliberate project links open in the system browser.

Creation and editing save through the operating system. Cancelling a save leaves the new package available in memory and marked unsaved. Closing or replacing unsaved work requires a discard choice. An edited copy retains the PDF, text derivative and contributor attribution and adds the earlier archive fingerprint as a declared revision reference. It does not add signatures or claim authenticated authorship.

Builds target a universal macOS ZIP, Windows x64 installer, and Linux x64 AppImage and Debian package. The first distribution is experimental and has no paid signing or notarization credentials. The earlier Swift macOS reader remains available in its original release.

Acceptance requires actual desktop creation and editing, exact PDF and context exports, independent Python read-back, save cancellation and unsaved-close handling, restricted renderer privileges, and rejected network and out-of-bundle access. The same desktop checks run on macOS, Windows and Linux before release. Download links go live only after their release assets exist. Platform builds and automated checks remain distinct from manual installation on a user's computer.
