#!/usr/bin/env bash
# plus: en modo desarrollo el Dock y el menú de macOS muestran «Electron», porque el nombre sale del
# Electron.app de node_modules. Esto le pone «Anytype Plus». Correr de nuevo después de cada `bun install`.
set -euo pipefail
PLIST="$(cd "$(dirname "$0")/../.." && pwd)/node_modules/electron/dist/Electron.app/Contents/Info.plist"
[ -f "$PLIST" ] || { echo "No existe $PLIST (corre bun install)"; exit 1; }
/usr/libexec/PlistBuddy -c "Set :CFBundleName Anytype Plus" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Anytype Plus" "$PLIST" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string Anytype Plus" "$PLIST"
echo "Electron de desarrollo renombrado a Anytype Plus"
