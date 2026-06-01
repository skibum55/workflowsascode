#!/usr/bin/env bash
set -e

cd /workspaces/workflowsascode

npm install -D @playwright/test

#npm install @playwright/cli --yes  -  THIS SHOULD BE INSTALLED IN THE devcontainer extensions

npx --yes playwright install --with-deps chromium 

#npx --yes @playwright/mcp@latest - DON'T DO THIS HERE.

npx --yes playwright-cli install --skills

npm install -D @playwright/mcp