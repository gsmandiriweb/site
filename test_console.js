import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    consoleErrors.push(err.message);
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:4321/prototype-steel-yard", { waitUntil: "networkidle" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);

  console.log(JSON.stringify({ consoleErrors }, null, 2));
  await browser.close();
})();
