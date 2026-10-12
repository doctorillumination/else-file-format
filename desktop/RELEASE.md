The desktop app now opens, creates and edits .else files locally on macOS, Windows and Linux. Start with one PDF, declare its source, and add two attributed interpretations. Save an edited copy, extract the unchanged original PDF, or save the selected AI-readable context as Markdown.

The website's format and authoring engine are bundled inside the app. No account, upload, model call, web connection or background update is needed. Native open and save dialogs are used. Cancelled saves and unsaved edits are protected before closing. A .else file association and an original-PDF drag control are included.

Downloads:

- macOS ZIP: universal application for Apple silicon and Intel Macs. Extract it and move Dotelse.app to Applications.
- Windows x64: per-user installer with an optional installation location.
- Linux x64 AppImage: portable download, requiring an executable permission and a system with AppImage/FUSE support.
- Linux x64 Debian package: installation through the distribution's normal package manager.

These are experimental distributions. The Mac application is locally signed and is not notarized by Apple. The Windows installer is not signed with a publisher certificate. Normal platform checks may flag these downloads. Source builds and the local website remain available. SHA256SUMS.txt records the exact release bytes; it is not an identity signature.

The supported file remains the unsigned `two-readings/0.1-experimental` profile, with one PDF and two interpretations. PDF creation supports 12 MiB, 200 pages and 65,536 characters of selectable text, without OCR. Edits preserve the PDF and text derivative and record the earlier archive fingerprint as a declared reference. Signatures, revision merging, live collaboration and Dear Elsewhere or Carry integration remain separate work.
