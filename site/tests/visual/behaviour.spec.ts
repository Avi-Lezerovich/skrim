// Interactions (FRONTEND_PLAN §6.3): table filter/sort with the live counter, CSV downloads,
// pollster highlighting on trends, the chart readout from the keyboard, theme, mobile tab bar.
// Tagged @desktop / @mobile; each tag runs in its own project.
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { okPolls, polls, settle } from "./helpers";

const BOM = [0xef, 0xbb, 0xbf];
const csvLines = (buf: Buffer) => buf.subarray(3).toString("utf8").trim().split("\r\n");
const kantar = polls.filter((p) => p.pollster === "kantar").length;

test("polls: filter, sort and counter, kept in the URL @desktop", async ({ page }) => {
  await page.goto("/polls/");
  const count = page.locator("#f-count");
  await expect(count).toHaveAttribute("aria-live", "polite");
  await expect(count).toHaveText(`${polls.length} סקרים`);

  await page.locator("select[name=pollster]").selectOption("kantar");
  await expect(count).toHaveText(`מוצגים ${kantar} מתוך ${polls.length} סקרים`);
  await expect(page.locator("#polls-table tbody tr:not([hidden])")).toHaveCount(kantar);
  await expect(page).toHaveURL(/pollster=kantar/);

  const header = page.locator("th[data-col=n]");
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "descending");
  const n = async () =>
    (await page.locator("#polls-table tbody tr:not([hidden]) td:nth-child(5)").evaluateAll((tds) =>
      tds.map((td) => Number((td as HTMLElement).dataset.v)).filter((v) => v > 0),
    )) as number[];
  const desc = await n();
  expect(desc).toEqual([...desc].sort((a, b) => b - a));
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", "ascending");
  expect(await page.locator("th[aria-sort]").count()).toBe(1);

  // A shared URL restores the same view.
  await page.reload();
  await expect(count).toHaveText(`מוצגים ${kantar} מתוך ${polls.length} סקרים`);
  await expect(header).toHaveAttribute("aria-sort", "ascending");
});

test("polls: empty state and clear @desktop", async ({ page }) => {
  await page.goto("/polls/?from=2030-01-01");
  await expect(page.locator("#f-empty")).toBeVisible();
  await page.locator("#f-empty-clear").click();
  await expect(page.locator("#f-count")).toHaveText(`${polls.length} סקרים`);
  await expect(page).toHaveURL(/\/polls\/$/);
});

test("csv: static files are UTF-8 with BOM and complete @desktop", async ({ request }) => {
  const all = Buffer.from(await (await request.get("/data/polls.csv")).body());
  expect([...all.subarray(0, 3)]).toEqual(BOM);
  expect(csvLines(all)).toHaveLength(polls.length + 1);

  const answers = Buffer.from(await (await request.get("/data/answers.csv")).body());
  expect([...answers.subarray(0, 3)]).toEqual(BOM);
  expect(csvLines(answers)[0]).toContain("label_raw");

  const avg = await (await request.get("/data/average.json")).json();
  expect(avg.parties.length).toBeGreaterThan(0);
});

test("csv: the filtered download holds exactly the rows shown @desktop", async ({ page }) => {
  await page.goto("/polls/?pollster=kantar");
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("#csv-filtered").click()]);
  const buf = readFileSync((await download.path())!);
  expect([...buf.subarray(0, 3)]).toEqual(BOM);
  const lines = csvLines(buf);
  expect(lines).toHaveLength(kantar + 1);
  expect(lines.slice(1).every((l) => l.split(",")[5] === "kantar")).toBe(true);
});

test("trends: highlighted pollster and range live in the URL @desktop", async ({ page }) => {
  const pollster = okPolls[0].pollster!;
  await page.goto(`/trends/?pollster=${pollster}`);
  await settle(page);
  await expect(page.locator("select[name=pollster]")).toHaveValue(pollster);
  await expect(page.locator("#pollster-msg")).toContainText("מודגשים");

  await page.getByText("14 יום").click();
  await expect(page).toHaveURL(/range=14/);
  await page.locator("select[name=pollster]").selectOption("");
  await expect(page).not.toHaveURL(/pollster=/);
  await expect(page.locator("#pollster-msg")).toHaveText("");
});

test("chart readout follows the arrow keys @desktop", async ({ page }) => {
  await page.goto("/");
  await settle(page);
  const box = page.locator("#bloc-chart .chart-box");
  const date = page.locator("#bloc-chart .ro-date");
  const latest = await date.textContent();
  await box.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(date).not.toHaveText(latest!);
  await page.keyboard.press("End");
  await expect(date).toHaveText(latest!);
});

test("theme switch persists across pages @desktop", async ({ page }) => {
  await page.goto("/");
  const toggle = page.locator(".theme-toggle");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.goto("/polls/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("primary navigation is a bottom tab bar with 44px targets @mobile", async ({ page }) => {
  await page.goto("/trends/");
  const nav = page.getByRole("navigation", { name: "ניווט ראשי" });
  const vh = page.viewportSize()!.height;
  const box = (await nav.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBe(vh);
  const links = nav.getByRole("link");
  await expect(links).toHaveCount(5);
  for (const b of await links.evaluateAll((as) => as.map((a) => a.getBoundingClientRect()))) {
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.width).toBeGreaterThanOrEqual(44);
  }
  await expect(nav.getByRole("link", { name: "מגמות" })).toHaveAttribute("aria-current", "page");
  // the sticky header stays on screen
  await page.mouse.wheel(0, 2000);
  expect((await page.locator(".site-header").boundingBox())!.y).toBe(0);
});

test("unknown paths get the site's own 404 page @mobile", async ({ page }) => {
  const res = await page.goto("/no-such-page/");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("הדף לא נמצא");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("polls show as cards on phones @mobile", async ({ page }) => {
  await page.goto("/polls/");
  await expect(page.locator(".polls-table-wrap")).toBeHidden();
  await expect(page.locator("#poll-cards > li")).toHaveCount(polls.length);
});
