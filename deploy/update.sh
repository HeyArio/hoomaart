#!/usr/bin/env bash
# Hooma Art updater: downloads the latest code from GitHub and re-runs the installer.
# Touches only Hooma Art's own files. Data in /var/lib/hoomaart and the admin password are kept.
set -euo pipefail
URL=https://github.com/HeyArio/hoomaart/archive/refs/heads/claude/festive-keller-u7tw21.tar.gz
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$URL" -o "$TMP/src.tar.gz"
mkdir "$TMP/src"; tar -xzf "$TMP/src.tar.gz" --strip-components=1 -C "$TMP/src"
[ -f "$TMP/src/server.js" ] || { echo "Download looks wrong; nothing was changed."; exit 1; }
cp -a "$TMP/src/." /opt/hoomaart/
bash /opt/hoomaart/deploy/install.sh
