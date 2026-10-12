#!/usr/bin/env python3
"""Publish only the tested, explicit platform packages from release artifacts."""
from pathlib import Path
import hashlib
import os
import subprocess

root = Path(__file__).resolve().parent.parent
folder = root / 'output/release-downloads'
expected = ['Dotelse-0.2.0-macOS-universal.zip', 'Dotelse-0.2.0-Windows-x64-Setup.exe',
            'Dotelse-0.2.0-Linux-x64.AppImage', 'Dotelse-0.2.0-Linux-x64.deb']
files = []
for name in expected:
    matches = list(folder.rglob(name))
    if len(matches) != 1:
        raise SystemExit('Missing or ambiguous tested download: ' + name)
    files.append(matches[0])
checksums = folder / 'SHA256SUMS.txt'
checksums.write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + p.name + '\n' for p in files))
tag = os.environ['GITHUB_REF_NAME']
if tag != 'v0.2.0-experiment':
    raise SystemExit('Review the release manifest before publishing another version.')
subprocess.run(['gh', 'release', 'create', tag, *map(str, files), str(checksums),
                '--repo', 'doctorillumination/else-file-format', '--prerelease',
                '--title', '.else desktop authoring experiment 0.2',
                '--notes-file', str(root / 'desktop/RELEASE.md')], check=True)
