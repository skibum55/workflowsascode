import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 30_000,
  outputDir: 'test-results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
    ['junit', { outputFile: 'reports/junit.xml' }],
  ],
  use: { trace: 'off', screenshot: 'off', video: 'off' },
  projects: [
    { name: 'safety', testMatch: 'dry-run.spec.mjs' },
    { name: 'harness', testMatch: 'harness.spec.mjs' },
    { name: 'acceptance', testMatch: 'acceptance.spec.mjs' },
  ],
});
