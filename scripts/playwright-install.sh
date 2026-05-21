#!/usr/bin/env bash
set -e
cd ..
printf 'y\n' | npm init playwright@latest . -- \
  --quiet \
  --browser=chromium \
  --install-deps
npm install @playwright/cli --yes
npx --yes playwright install --with-deps chromium 
npx --yes @playwright/mcp@latest 
npx --yes playwright-cli install --skills
