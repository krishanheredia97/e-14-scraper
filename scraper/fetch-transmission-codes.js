require('dotenv').config();
const fs = require('fs');
const { webkit } = require('playwright');
const { BASE_URL } = require('./constants');

const TARGETS = [
  {
    path: '/assets/temis/divipol_json/allTransmissionCodes.json',
    output: 'allTransmissionCodes.json',
  },
  {
    path: '/assets/temis/divipol_json/departmentsTree.json',
    output: 'departmentsTree.json',
  },
];

(async () => {
  const headless = process.env.HEADLESS !== 'false';
  const departmentUrl = `${BASE_URL}/departamento/19`;

  const browser = await webkit.launch({ headless });
  const page = await browser.newPage();

  const captured = new Set();

  page.on('response', async (response) => {
    const target = TARGETS.find((t) => response.url().includes(t.output));
    if (!target) return;

    const status = response.status();
    console.log(`Intercepted ${target.output} — HTTP ${status}`);
    try {
      const body = await response.body();
      fs.writeFileSync(target.output, body);
      console.log(`Saved ${body.length} bytes to ${target.output}`);
      captured.add(target.output);
    } catch (err) {
      console.error(`Failed to read response body for ${target.output}:`, err.message);
    }
  });

  try {
    console.log(`Navigating to ${departmentUrl}`);
    await page.goto(departmentUrl, { waitUntil: 'networkidle', timeout: 120000 });
    console.log('Department page loaded. Waiting a few seconds for requests...');
    await page.waitForTimeout(5000);

    for (const target of TARGETS) {
      if (captured.has(target.output)) continue;

      const targetUrl = `${BASE_URL}${target.path}`;
      console.log(`Not captured via page load; trying direct GET: ${targetUrl}`);
      const direct = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 30000 });
      console.log(`Direct GET status for ${target.output}: ${direct.status()}`);
      try {
        const body = await direct.body();
        fs.writeFileSync(target.output, body);
        console.log(`Saved ${body.length} bytes to ${target.output}`);
        captured.add(target.output);
      } catch (err) {
        console.error(`Direct GET failed to read body for ${target.output}:`, err.message);
      }
    }

    const missing = TARGETS.filter((t) => !captured.has(t.output));
    console.log(
      missing.length === 0
        ? 'Success — all JSON files captured.'
        : `Failed — could not capture: ${missing.map((m) => m.output).join(', ')}`
    );
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
