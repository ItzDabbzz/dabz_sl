import express from 'express';
import { scrapeMarketplace } from './scrape';

const app = express();
app.use(express.json());

app.post('/scrape', async (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid url' });
    }
    try {
        const data = await scrapeMarketplace(url);
        res.json({ success: true, data });
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Scraping failed' });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Scraper API listening on port ${port}`);
});
