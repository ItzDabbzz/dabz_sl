import { chromium, BrowserContext } from 'playwright';
import path from 'path';
import fs from 'fs/promises';

const SL_MARKETPLACE_LOGIN_URL = 'https://marketplace.secondlife.com/login';
const COOKIES_PATH = path.resolve(__dirname, '../.sl_cookies.json');

const SL_USERNAME = process.env.SL_USERNAME;
const SL_PASSWORD = process.env.SL_PASSWORD;

async function loadCookies(context: BrowserContext) {
  try {
    const cookiesJson = await fs.readFile(COOKIES_PATH, 'utf-8');
    const cookies = JSON.parse(cookiesJson);
    await context.addCookies(cookies);
    return true;
  } catch {
    return false;
  }
}

async function saveCookies(context: BrowserContext) {
  const cookies = await context.cookies();
  await fs.writeFile(COOKIES_PATH, JSON.stringify(cookies, null, 2), 'utf-8');
}

async function ensureLoggedIn(page: any) {
  await page.goto('https://marketplace.secondlife.com/', { waitUntil: 'domcontentloaded' });
  // Check if already logged in (look for user menu or similar)
  const loggedIn = await page.locator('a[href*="account"]:visible').first().isVisible().catch(() => false);
  if (loggedIn) return;
  // Go to login page
  await page.goto(SL_MARKETPLACE_LOGIN_URL, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="username"]', SL_USERNAME || '');
  await page.fill('input[name="password"]', SL_PASSWORD || '');
  await page.click('button[type="submit"]');
  // Wait for login to complete (look for user menu)
  await page.waitForSelector('a[href*="account"]:visible', { timeout: 10000 });
}

export async function scrapeMarketplace(url: string): Promise<any> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  let loggedIn = false;
  try {
    // Try to load cookies
    if (await loadCookies(context)) {
      const page = await context.newPage();
      await page.goto('https://marketplace.secondlife.com/', { waitUntil: 'domcontentloaded' });
      const stillLoggedIn = await page.locator('a[href*="account"]:visible').first().isVisible().catch(() => false);
      if (stillLoggedIn) {
        loggedIn = true;
        await page.close();
      } else {
        await page.close();
      }
    }
    if (!loggedIn) {
      const page = await context.newPage();
      await ensureLoggedIn(page);
      await saveCookies(context);
      await page.close();
    }
    // Now scrape the target page
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const title = await page.locator('h1').first().textContent();
    // Add more scraping logic as needed
    await page.close();
    return { title };
  } finally {
    await browser.close();
  }
}
