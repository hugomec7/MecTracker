#!/usr/bin/env bash
# Monta o zip da release: MecTracker_<versão>.zip com a pasta MecTracker-Installer/.
# Uso: tools/release/build-zip.sh [pasta de saída]   (padrão: dist-release/)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${1:-$ROOT/dist-release}"
VER="$(node -p "require('$ROOT/com.mectracker/manifest.json').version")"
WORK="$(mktemp -d)"; D="$WORK/MecTracker-Installer"
mkdir -p "$D/Tutoriais" "$D/Claude" "$OUT"

cp -R "$ROOT/com.mectracker" "$D/"
cp "$ROOT/Install-Windows.bat" "$ROOT/Install-Mac.command" "$D/"
cp "$ROOT"/docs/guides/*.pdf "$D/"
(cd "$D/com.mectracker" && zip -qr -X ../MecTracker.ccx .)

# vídeos com nomes em português (como nas releases anteriores)
while IFS='|' read -r src dst; do
  [ -n "$src" ] && cp "$ROOT/docs/tutorials/$src" "$D/Tutoriais/$dst"
done < "$ROOT/tools/release/tutoriais.txt"

cp "$ROOT/dist/MecTracker.mcpb" "$ROOT/mcp/server.js" "$ROOT/tools/release/Claude-LEIA-ME.txt" "$D/Claude/"
mv "$D/Claude/Claude-LEIA-ME.txt" "$D/Claude/LEIA-ME.txt"

rm -f "$OUT/MecTracker_$VER.zip"
(cd "$WORK" && zip -qr -X "$OUT/MecTracker_$VER.zip" MecTracker-Installer)
rm -rf "$WORK"
echo "$OUT/MecTracker_$VER.zip"
