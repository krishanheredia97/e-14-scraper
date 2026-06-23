require('dotenv').config();
const { webkit } = require('playwright');
const { BASE_URL, DEPARTMENTS } = require('./constants');

(async () => {
  const headless = process.env.HEADLESS !== 'false';
  const appEnv = process.env.APP_ENV || 'prod';
  const devDpto = process.env.DEV_DPTO;

  const departments =
    appEnv === 'dev' && devDpto
      ? DEPARTMENTS.filter(
          (d) => parseInt(d.code, 10) === parseInt(devDpto, 10)
        )
      : DEPARTMENTS;

  if (appEnv === 'dev' && (!devDpto || departments.length === 0)) {
    console.error(
      'DEV mode requires DEV_DPTO to match one of the known department codes.'
    );
    process.exitCode = 1;
    return;
  }

  const browser = await webkit.launch({ headless });

  try {
    for (const dept of departments) {
      const page = await browser.newPage();
      const url = `${BASE_URL}/departamento/${dept.code.padStart(2, '0')}`;

      console.log(`Opening ${dept.name}: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });
      console.log(`Loaded ${dept.name}`);

      await page.close();
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
