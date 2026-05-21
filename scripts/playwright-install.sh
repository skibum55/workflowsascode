#!/usr/bin/env bash
set -e

cd /workspaces/workflowsascode

npm install -D @playwright/test

#npm install @playwright/cli --yes

npx --yes playwright install --with-deps chromium 

#npx --yes @playwright/mcp@latest 

npx --yes playwright-cli install --skills
