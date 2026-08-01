import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });

  // Test mobile viewport: 390x844
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const mobilePage = await mobileContext.newPage();

  const consoleErrors = [];
  mobilePage.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push({ message: msg.text(), url: mobilePage.url() });
    }
  });

  console.log("--- MOBILE VIEWPORT (390x844) ---");
  await mobilePage.goto("http://127.0.0.1:4321/prototype-steel-yard");
  await mobilePage.waitForLoadState("networkidle");

  // Evaluate hero elements
  const mobileHeroData = await mobilePage.evaluate(() => {
    const nav = document.querySelector("nav, header");
    const headline = document.querySelector("h1");
    const lede = document.querySelector("p.lede, .hero p, main p:first-of-type");
    const ctas = Array.from(
      document.querySelectorAll(".hero a, .hero button, main a.btn, main button"),
    );
    const proofStrip = document.querySelector('.proof, .stats, [class*="proof"], [class*="stat"]');
    const productPlate = document.querySelector(
      '.product-plate, [class*="product"], [class*="plate"]',
    );
    const images = Array.from(document.querySelectorAll("img"));

    return {
      title: document.title,
      nav: nav ? { html: nav.outerHTML.slice(0, 300), rect: nav.getBoundingClientRect() } : null,
      headline: headline
        ? {
            text: headline.innerText,
            rect: headline.getBoundingClientRect(),
            styles: window.getComputedStyle(headline).fontSize,
          }
        : null,
      lede: lede ? { text: lede.innerText, rect: lede.getBoundingClientRect() } : null,
      ctas: ctas.map((c) => ({
        text: c.innerText,
        rect: c.getBoundingClientRect(),
        tag: c.tagName,
        href: c.getAttribute("href"),
      })),
      proofStrip: proofStrip
        ? { html: proofStrip.outerHTML.slice(0, 300), rect: proofStrip.getBoundingClientRect() }
        : null,
      productPlate: productPlate
        ? { html: productPlate.outerHTML.slice(0, 300), rect: productPlate.getBoundingClientRect() }
        : null,
      images: images.map((img) => ({
        src: img.src,
        alt: img.alt,
        rect: img.getBoundingClientRect(),
        naturalWidth: img.naturalWidth,
      })),
      bodyHeight: document.body.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  console.log("Mobile Hero Data:", JSON.stringify(mobileHeroData, null, 2));

  // Take screenshot for mobile
  await mobilePage.screenshot({ path: "mobile_hero.png", fullPage: true });

  // Test tablet viewport: 768x1024
  console.log("\n--- TABLET VIEWPORT (768x1024) ---");
  const tabletContext = await browser.newContext({
    viewport: { width: 768, height: 1024 },
  });
  const tabletPage = await tabletContext.newPage();
  await tabletPage.goto("http://127.0.0.1:4321/prototype-steel-yard");
  await tabletPage.waitForLoadState("networkidle");

  const tabletHeroData = await tabletPage.evaluate(() => {
    const headline = document.querySelector("h1");
    const ctas = Array.from(
      document.querySelectorAll(".hero a, .hero button, main a.btn, main button"),
    );
    return {
      headline: headline
        ? { text: headline.innerText, rect: headline.getBoundingClientRect() }
        : null,
      ctas: ctas.map((c) => ({ text: c.innerText, rect: c.getBoundingClientRect() })),
    };
  });

  console.log("Tablet Hero Data:", JSON.stringify(tabletHeroData, null, 2));
  await tabletPage.screenshot({ path: "tablet_hero.png", fullPage: true });

  console.log("Console Errors:", consoleErrors);

  await browser.close();
})();
