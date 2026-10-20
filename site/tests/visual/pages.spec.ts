// Every page, in every project (375 / 768 / 1440 × light / dark): no serious or critical axe
// violations, no horizontal overflow, the Hebrew web font loaded, charts drawn with a label
// and the right number of dots. Full-page screenshots compare against approved baselines
// only when VISUAL=1, because baselines differ per OS (CI runs on Linux).
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { blocDots, flaggedPoll, hebrewFontLoaded, partyDots, reviewPoll, settle } from "./helpers";

const pages = [
  { name: "home", path: "/" },
  { name: "trends", path: "/trends/" },
  { name: "polls", path: "/polls/" },
  { name: "poll", path: `/polls/${flaggedPoll}/` },
  { name: "poll-review", path: `/polls/${reviewPoll}/` },
  { name: "pollsters", path: "/pollsters/" },
  { name: "methodology", path: "/methodology/" },
  { name: "data", path: "/data/" },
];

for (const p of pages) {
  test(p.name, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(p.path);
    await settle(page);

    const axe = await new AxeBuilder({ page }).analyze();
    const serious = axe.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    expect(serious, "axe serious/critical violations").toEqual([]);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);

    expect(await hebrewFontLoaded(page), "IBM Plex Sans Hebrew (Hebrew subset) loaded").toBe(true);
    expect(errors, "uncaught page errors").toEqual([]);

    if (process.env.VISUAL) await expect(page).toHaveScreenshot(`${p.name}.png`, { fullPage: true });
  });
}

test("charts: bloc chart is labelled and draws one dot per poll per bloc", async ({ page }) => {
  await page.goto("/");
  await settle(page);
  const svg = page.locator("#bloc-chart svg[role=img]");
  await expect(svg).toHaveAttribute("aria-label", /.+/);
  await expect(svg.locator("[aria-label]")).toHaveCount(0); // marks are silent
  await expect(svg.locator("g:not(.scrub) circle")).toHaveCount(blocDots);
});

test("charts: every party on trends is drawn, with one dot per poll", async ({ page }) => {
  await page.goto("/trends/");
  await settle(page);
  for (const id of ["likud", "yashar"]) {
    await expect(page.locator(`[data-party="${id}"]`)).toHaveAttribute("role", "img");
    await expect(page.locator(`[data-party="${id}"] svg circle`)).toHaveCount(partyDots(id));
  }
});
