#!/usr/bin/env bash
set -euo pipefail

# Vercel's Amazon Linux image omits these Chromium runtime libraries.
if [[ "$(uname -s)" == Linux ]] && command -v dnf >/dev/null 2>&1; then
  dnf install -y nss nspr mesa-libgbm
fi

npx playwright install --only-shell chromium
