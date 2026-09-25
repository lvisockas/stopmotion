#!/usr/bin/env sh
# Playwright's open-source Chromium ships without an H.264 encoder, so the
# export test needs a Chrome build. Downloads Chrome for Testing's headless
# shell into .chrome/ and prints the CHROMIUM_PATH to use.
set -eu
cd "$(dirname "$0")/../.."
V=$(curl -sS https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).channels.Stable.version))')
mkdir -p .chrome
curl -sS -o .chrome/shell.zip "https://storage.googleapis.com/chrome-for-testing-public/$V/linux64/chrome-headless-shell-linux64.zip"
(cd .chrome && unzip -q -o shell.zip && rm shell.zip)
echo "$(pwd)/.chrome/chrome-headless-shell-linux64/chrome-headless-shell"
