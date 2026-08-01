import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Test Desktop 1440x900
  const pageDesktop = await context.newPage();
  await pageDesktop.setViewportSize({ width: 1440, height: 900 });
  await pageDesktop.goto("http://127.0.0.1:4321/prototype-steel-yard", {
    waitUntil: "networkidle",
  });

  // Check horizontal overflow on desktop
  const desktopOverflow = await pageDesktop.evaluate(() => {
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

  // Check hero title, lede, product plate
  const desktopMetrics = await pageDesktop.evaluate(() => {
    const heroTitle =
      document.querySelector("h1") ||
      document.querySelector(".hero-title") ||
      document.querySelector('[class*="title"]');
    const lede = document.querySelector(".lede") || document.querySelector("p");
    const productPlate =
      document.querySelector(".product-plate") ||
      document.querySelector('[class*="plate"]') ||
      document.querySelector('[class*="product"]');

    return {
      heroTitleText: heroTitle ? heroTitle.innerText : null,
      heroTitleFontSize: heroTitle ? window.getComputedStyle(heroTitle).fontSize : null,
      ledeText: lede ? lede.innerText : null,
      hasProductPlate: !!productPlate,
      productPlateRect: productPlate ? productPlate.getBoundingClientRect().toJSON() : null,
    };
  });

  await pageDesktop.screenshot({ path: "desktop-1440.png", fullPage: true });

  // Test Mobile 390x844
  const pageMobile = await context.newPage();
  await pageMobile.setViewportSize({ width: 390, height: 844 });
  await pageMobile.goto("http://127.0.0.1:4321/prototype-steel-yard", { waitUntil: "networkidle" });

  const mobileOverflow = await pageMobile.evaluate(() => {
    return {
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

  const mobileMetrics = await pageMobile.evaluate(() => {
    const heroTitle = document.querySelector("h1") || document.querySelector(".hero-title");
    return {
      heroTitleText: heroTitle ? heroTitle.innerText : null,
      heroTitleFontSize: heroTitle ? window.getComputedStyle(heroTitle).fontSize : null,
    };
  });

  await pageMobile.screenshot({ path: "mobile-390.png", fullPage: true });

  console.log(
    JSON.stringify(
      {
        desktopOverflow,
        desktopMetrics,
        mobileOverflow,
        mobileMetrics,
      },
      null,
      2,
    ),
  );

  await browser.close();
})();
