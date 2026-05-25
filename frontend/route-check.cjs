const { chromium } = require('playwright');
(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const routes = ['/', '/study', '/study/library', '/study/driving-license', '/study/academy', '/study/video-lectures', '/tickets', '/pricing', '/privacy', '/terms'];
  const results = [];
  for (const route of routes) {
    const errors = [];
    page.removeAllListeners('pageerror');
    page.removeAllListeners('console');
    page.on('pageerror', (err) => errors.push(`pageerror:${err.message}`));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console:${msg.text()}`); });
    try {
      const resp = await page.goto(`http://127.0.0.1:5173${route}`, { waitUntil: 'networkidle', timeout: 60000 });
      let title = '';
      try { title = (await page.locator('h1').first().textContent()) || ''; } catch {}
      results.push({ route, status: resp ? resp.status() : null, title, errors: errors.slice(0, 5) });
    } catch (error) {
      results.push({ route, status: null, title: '', errors: [String(error)] });
    }
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})();
