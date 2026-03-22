import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Main scraper function.
 */
export const scrapeMetadata = async (url: string): Promise<string> => {
  try {
    // 1. Fetch raw HTML with a realistic User-Agent to prevent bot-blocking
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      timeout: 8000,
    });

    const $ = cheerio.load(data);

    const title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    return `${title.trim()}. ${description.trim()}`.trim();
  } catch (error) {
    console.warn(`⚠️ Failed to scrape metadata for ${url}:`, (error as Error).message);
    return ''; // Return gracefully so the worker loop doesn't crash
  }
};
