import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("/root/rice/site/.env", "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    }),
);

const browser = await chromium.launch();
const page = await (
  await browser.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: "UTC" })
).newPage();
page.on("console", (m) => {
  if (m.type() === "error") console.log("[page error]", m.text().slice(0, 200));
});

await page.goto("https://site.gsmandiri-web.workers.dev/admin/login");
await page.fill("#username", env.CMS_OWNER_USERNAME);
await page.fill("#password", env.CMS_OWNER_PASSWORD);
await Promise.all([page.waitForURL("**/admin"), page.click("button.submit")]);
await page.waitForSelector(".cms-rail");
await page.waitForTimeout(4000);

await page.locator(".cms-post-list button", { hasText: "Test 8" }).first().click();
await page.waitForSelector("#schedule-at", { timeout: 30000 });
await page.waitForTimeout(1200);

const target = new Date(Date.now() + 6 * 60 * 1000);
const pad = (n) => String(n).padStart(2, "0");
const local = `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(target.getUTCDate())}T${pad(target.getUTCHours())}:${pad(target.getUTCMinutes())}`;
console.log("SET_AT=" + target.toISOString());
console.log("input value:", local);

await page.fill("#schedule-at", local);
await page.click('.cms-rail button:has-text("Jadwalkan")');
await page.waitForSelector(".cms-notice, .cms-error", { timeout: 120000 });
const message = (await page.textContent(".cms-notice, .cms-error"))?.replace(/\s+/g, " ").trim();
console.log("UI:", message);
await page.waitForTimeout(2500);
await page.screenshot({ path: "/tmp/e2e-scheduled.png" });
await browser.close();
