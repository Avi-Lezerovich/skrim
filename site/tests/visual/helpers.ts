// Shared helpers: expectations computed from the same JSON the site is built from, and a
// "settle" step that waits for fonts and the lazily loaded charts.
import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";

const json = (name: string) => JSON.parse(readFileSync(new URL(`../../src/data/${name}`, import.meta.url), "utf8"));

type Poll = {
  key: string;
  status: string;
  field_date: string | null;
  pollster: string | null;
  flags: unknown[];
  blocs: Record<string, number | null> | null;
  seats: Record<string, number>;
};
export const polls = json("polls.json") as Poll[];
export const okPolls = polls.filter((p) => p.status === "ok");

/** Dots in the bloc chart: one per poll per shown bloc. */
export const blocDots = ["coalition", "opposition", "arab"].reduce(
  (n, b) => n + okPolls.filter((p) => p.blocs && p.field_date && p.blocs[b] != null).length,
  0,
);
/** Dots in one party's trends chart over the full range. */
export const partyDots = (id: string) => okPolls.filter((p) => p.field_date && id in p.seats).length;

export const flaggedPoll = okPolls.find((p) => p.flags.length > 0)!.key;
export const reviewPoll = polls.find((p) => p.status !== "ok")!.key;

/** Wait for web fonts and scroll every lazy chart into view until its SVG is drawn. */
export async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  const bloc = page.locator("#bloc-chart .chart-box");
  if (await bloc.count()) {
    await bloc.scrollIntoViewIfNeeded();
    await expect(page.locator("#bloc-chart svg[role=img]")).toBeVisible();
  }
  const grid = page.locator(".party-grid");
  if (await grid.count()) {
    await grid.scrollIntoViewIfNeeded();
    const n = await page.locator(".party-chart").count();
    await expect(page.locator(".party-chart svg")).toHaveCount(n);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

/** The Hebrew 400 face of IBM Plex Sans Hebrew has actually loaded (not just the Latin one). */
export const hebrewFontLoaded = (page: Page) =>
  page.evaluate(() =>
    [...document.fonts].some(
      (f) => f.family.includes("IBM Plex Sans Hebrew") && f.weight === "400" && /590/i.test(f.unicodeRange) && f.status === "loaded",
    ),
  );
