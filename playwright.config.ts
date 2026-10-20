import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against a production build with seeded data.
//   pnpm db:reset && pnpm seed      # once, for a clean database
//   pnpm test:e2e                   # builds, starts the app, runs the flow
// Set E2E_BASE_URL to test an already-running server instead.
// PLAYWRIGHT_CHROMIUM_PATH points at a preinstalled Chromium when needed.

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  // The flow checks dashboard counts, so tests run one at a time.
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], launchOptions: { executablePath } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm build && pnpm start --port 3000",
        url: `${baseURL}/login`,
        reuseExistingServer: true,
        timeout: 300_000,
      },
});
