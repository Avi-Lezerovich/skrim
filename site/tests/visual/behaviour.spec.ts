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

test("chart readout links to the polls behind the day @mobile", async ({ page }) => {
  await page.goto("/");
  const link = page.locator("#bloc-chart .ro-src");
  await expect(link).toHaveAttribute("href", /\/polls\?from=\d{4}-\d\d-\d\d&to=\d{4}-\d\d-\d\d&status=ok/);
  await link.click();
  await expect(page.locator("#f-count")).toContainText("מוצגים");
});

test("share previews: complete Open Graph tags with an absolute 1200×630 image under 300KB @desktop", async ({ page, request }) => {
  for (const path of ["/", "/trends/", "/polls/", `/polls/${okPolls[0].key}/`, "/pollsters/", "/methodology/"]) {
    await page.goto(path);
    const tags = await page.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll("meta[property^='og:'], meta[name^='twitter:']")].map((m) => [
          m.getAttribute("property") ?? m.getAttribute("name"),
          m.getAttribute("content"),
        ]),
      ),
    );
    for (const k of ["og:title", "og:description", "og:url", "og:image", "og:image:alt", "twitter:card", "twitter:image"])
      expect(tags[k], `${path} ${k}`).toBeTruthy();
    expect(tags["og:site_name"]).toBe("skrim");
    expect(tags["og:locale"]).toBe("he_IL");
    expect(tags["twitter:card"]).toBe("summary_large_image");
    expect(tags["og:image"]).toMatch(/^https:\/\//);
    expect([tags["og:image:width"], tags["og:image:height"]]).toEqual(["1200", "630"]);
    // the image itself, from this build
    const res = await request.get(new URL(tags["og:image"]).pathname);
    expect(res.status(), `${path} image`).toBe(200);
    const buf = Buffer.from(await res.body());
    expect(buf.length).toBeLessThan(300 * 1024);
    if (buf.subarray(1, 4).toString() === "PNG") expect([buf.readUInt32BE(16), buf.readUInt32BE(20)]).toEqual([1200, 630]);
  }
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

test("polls list on phones: compact rows, paged, filters in a bottom sheet with chips @mobile", async ({ page }) => {
  await page.goto("/polls/");
  await expect(page.locator(".polls-table-wrap")).toBeHidden();
  const rows = page.locator("#poll-compact tbody tr");
  await expect(rows).toHaveCount(polls.length);
  await expect(page.locator("#poll-compact tbody tr:visible")).toHaveCount(30);
  await page.locator("#f-more").click();
  await expect(page.locator("#poll-compact tbody tr:visible")).toHaveCount(Math.min(60, polls.length));

  // no horizontal scroll in the list
  const overflow = await page.locator(".polls-compact-wrap").evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: /סינון ומיון/ }).click();
  const sheet = page.getByRole("dialog", { name: "סינון ומיון" });
  await expect(sheet).toBeVisible();
  await sheet.locator("select[name=pollster]").selectOption("kantar");
  await sheet.getByRole("button", { name: `הצגת ${kantar} סקרים` }).click();
  await expect(sheet).toBeHidden();
  await expect(page.locator("#f-count")).toHaveText(`מוצגים ${kantar} מתוך ${polls.length} סקרים`);
  await expect(page.locator("#poll-compact tbody tr:visible")).toHaveCount(Math.min(30, kantar));

  const chip = page.locator(".filter-chips .chip");
  await expect(chip).toHaveCount(1);
  await expect(chip).toContainText("סוקר");
  await chip.click();
  await expect(page.locator("#f-count")).toHaveText(`${polls.length} סקרים`);
  await expect(page).toHaveURL(/\/polls\/$/);
});
