// Build for GitHub Pages (https://avi-lezerovich.github.io/skrim/): share images, then the site
// under the /skrim base, plus .nojekyll so Pages serves the _astro/ folder. Plain Node instead
// of `VAR=… cmd`, so it also runs on Windows. Output: dist/, ready for the gh-pages branch.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const env = { ...process.env, SITE_URL: "https://avi-lezerovich.github.io", BASE_PATH: "/skrim" };
execSync("node scripts/og.mjs", { stdio: "inherit", env });
execSync("npx astro build", { stdio: "inherit", env });
writeFileSync(new URL("../dist/.nojekyll", import.meta.url), "");
