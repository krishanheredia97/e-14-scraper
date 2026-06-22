require('dotenv').config();
const { webkit } = require('playwright');

(async () => {
  const headless = process.env.HEADLESS !== 'false';
  const url = 'https://e14segundavueltapresidente.registraduria.gov.co/home';

  const browser = await webkit.launch({ headless });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });

    await page.waitForSelector('.table-container .tbody .data-row', { timeout: 30000 });

    const departamentos = await page.$$eval(
      '.table-container .tbody .data-row .td.departamento a',
      (links) => links.map((link) => link.textContent.trim())
    );

    console.log('Departamentos:');
    departamentos.forEach((departamento) => console.log(departamento));
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
