import { defineConfig, devices } from "@playwright/test";

/**
 * The end-to-end specs run against a built app, headless, on one port of its
 * own. A WebGL map needs software rendering in a headless browser, so the two
 * flags below are not optional: without them the map never paints and every
 * spec that waits for the report times out.
 *
 * Set EMERGE_E2E_URL to point the specs at a server that is already running.
 */
const port = Number(process.env.EMERGE_E2E_PORT ?? 4311);
const baseURL = process.env.EMERGE_E2E_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: process.env.EMERGE_E2E_URL
    ? undefined
    : {
        command: `npx next start -p ${port}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
