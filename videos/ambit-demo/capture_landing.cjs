const puppeteer = require('/usr/local/lib/node_modules/hyperframes/node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');

const outDir = '/root/Ambit/videos/ambit-demo/plates';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/root/.cache/puppeteer/chrome-headless-shell/linux-153.0.8010.36/chrome-headless-shell-linux64/chrome-headless-shell',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto('https://www.ambit.surf/', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 1000));

  // 1. Capture the navbar alone
  await page.evaluate(() => {
    const h = document.querySelector('header.topbar');
    if (h) {
      h.style.background = '#f4f6f4';
      h.style.borderBottom = '1px solid #d1d8d4';
    }
  });
  const header = await page.$('header.topbar');
  if (header) {
    await header.screenshot({ path: path.join(outDir, '01_landing_nav.png') });
    console.log('Saved 01_landing_nav.png');
  }

  // 2. Hide the navbar on the page so it does NOT appear in 01_landing_full.png
  await page.evaluate(() => {
    const h = document.querySelector('header.topbar');
    if (h) {
      h.style.visibility = 'hidden';
    }
  });

  // Capture continuous landing page content
  await page.screenshot({
    path: path.join(outDir, '01_landing_full.png'),
    clip: { x: 0, y: 0, width: 1920, height: 2200 }
  });
  console.log('Saved 01_landing_full.png');

  await browser.close();
})();
