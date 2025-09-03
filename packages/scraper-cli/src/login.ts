import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { resolveOut } from "./utils";

(async () => {
  const storageFile = resolveOut(path.join("out", "auth.json"));

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(60000);

  console.log("Opening Second Life Marketplace account page...");
  await page.goto("https://marketplace.secondlife.com/account", { waitUntil: "domcontentloaded", timeout: 60000 });

  console.log("Please log in manually. After successful login, press Enter in this terminal.");

  process.stdin.setEncoding("utf8");
  console.log("Waiting for Enter...");
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  try {
    await page.waitForSelector('a[href^="/accounts/"], a[href^="/account/"], a#user-menu', { timeout: 5000 });
  } catch (e) {
    console.warn("Could not verify login automatically. Saving storage anyway.");
  }

  await context.storageState({ path: storageFile });
  console.log(`Saved session to ${storageFile}`);

  await browser.close();
})();
