/**
 * scraper-api server entry point.
 *
 * Run with:
 *   node dist/index.js
 *   PORT=3000 SCRAPER_API_KEY=secret node dist/index.js
 */

import { app, PORT } from './app.js';

app.listen(PORT, () => {
  console.log(`scraper-api listening on http://0.0.0.0:${PORT}`);
});
