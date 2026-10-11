#!/bin/zsh
set -euo pipefail
experiment_root="${0:A:h}"
app_bundle="$experiment_root/output/Else Experiment.app"
cd "$experiment_root"
mkdir -p "$app_bundle/Contents/MacOS" "$app_bundle/Contents/Resources"
architectures=("$(uname -m)")
if [[ "${1:-}" == "--universal" ]]; then
  architectures=(arm64 x86_64)
elif [[ $# -ne 0 ]]; then
  print -u2 'Usage: zsh build.sh [--universal]'
  exit 1
fi
for architecture in "${architectures[@]}"; do
  xcrun swiftc -swift-version 5 -O -target "$architecture-apple-macosx14.0" -framework AppKit -framework PDFKit -framework CryptoKit NativeReader.swift -o "$experiment_root/output/ElseExperiment-$architecture"
done
if [[ ${#architectures[@]} -eq 2 ]]; then
  lipo -create "$experiment_root/output/ElseExperiment-arm64" "$experiment_root/output/ElseExperiment-x86_64" -output "$app_bundle/Contents/MacOS/ElseExperiment"
else
  cp "$experiment_root/output/ElseExperiment-${architectures[1]}" "$app_bundle/Contents/MacOS/ElseExperiment"
fi
icon_set="$experiment_root/output/AppIcon.iconset"
mkdir -p "$icon_set"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" assets/ElseIcon.png --out "$icon_set/icon_${size}x${size}.png" >/dev/null
  doubled=$(( size * 2 ))
  sips -z "$doubled" "$doubled" assets/ElseIcon.png --out "$icon_set/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$icon_set" -o "$app_bundle/Contents/Resources/AppIcon.icns"
cp "$experiment_root/specimen/One-file-two-readings.else" "$app_bundle/Contents/Resources/"
cp "$experiment_root/reader.py" "$app_bundle/Contents/Resources/"
cp "$experiment_root/LICENSE" "$app_bundle/Contents/Resources/LICENSE.txt"
rm -f "$app_bundle/Contents/Resources/Inspection-reader.html"
python3 reader.py specimen/One-file-two-readings.else --html "$app_bundle/Contents/Resources/Inspection-reader.html" >/dev/null
cat > "$app_bundle/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>ElseExperiment</string>
<key>CFBundleIdentifier</key><string>space.cyberdelic.else-experiment</string>
<key>CFBundleName</key><string>Else Experiment</string>
<key>CFBundleDisplayName</key><string>Else Experiment</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>0.1</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSPrincipalClass</key><string>NSApplication</string>
</dict></plist>
PLIST
codesign --force --sign - "$app_bundle"
print -r -- "$app_bundle"
