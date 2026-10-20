// Page matrix (FRONTEND_PLAN §6.3): every page at three widths, light and dark, against the
// built site served by `astro preview`. Run `npm run build` first; CI does.
import { defineConfig } from "@playwright/test";

const PORT = 4323;
const sizes = [
  { name: "375", viewport: { width: 375, height: 812 } },
  { name: "768", viewport: { width: 768, height: 1024 } },
  { name: "1440", viewport: { width: 1440, height: 900 } },
];
const schemes = ["light", "dark"] as const;

export default defineConfig({
  testDir: ".",
  outputDir: "../../test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { outputFolder: "../../playwright-report", open: "never" }]] : "list",
  expect: {
    // Screenshot baselines are approved by hand; see pages.spec.ts.
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: "disabled" },
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    trace: "retain-on-failure",
  },
  projects: [
    ...sizes.flatMap((s) =>
      schemes.map((colorScheme) => ({
        name: `${s.name}-${colorScheme}`,
        testMatch: "pages.spec.ts",
        use: { browserName: "chromium" as const, viewport: s.viewport, colorScheme },
      })),
    ),
    {
      name: "behaviour-desktop",
      testMatch: "behaviour.spec.ts",
      grep: /@desktop/,
      use: { browserName: "chromium" as const, viewport: { width: 1440, height: 900 }, colorScheme: "light" },
    },
    {
      name: "behaviour-mobile",
      testMatch: "behaviour.spec.ts",
      grep: /@mobile/,
      use: { browserName: "chromium" as const, viewport: { width: 375, height: 812 }, colorScheme: "light" },
    },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --host 127.0.0.1`,
    cwd: "../..",
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
