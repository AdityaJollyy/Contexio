import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Specialized YouTube Scraper based on ytInitialPlayerResponse
 * Extracts real title and description without needing a YouTube API key
 */
const scrapeYouTubeMetadata = (htmlData: string): string | null => {
  try {
    const jsonString = htmlData.split('ytInitialPlayerResponse = ')[1]?.split(';</script>')[0];

    if (!jsonString) {
      console.warn('⚠️ Could not extract YouTube JSON structure.');
      return null;
    }

    const parsed = JSON.parse(jsonString);
    const realTitle = parsed?.videoDetails?.title || '';
    const realDescription = parsed?.videoDetails?.shortDescription || '';

    if (!realTitle && !realDescription) {
      return null;
    }

    return `${realTitle}. ${realDescription}`.trim();
  } catch (error) {
    console.warn('⚠️ YouTube JSON parsing failed, triggering fallback.');
    return null;
  }
};

/**
 * Main scraper function.
 * Note: O(1) checks using the 'type' parameter passed directly from the database!
 */
export const scrapeMetadata = async (url: string, type: string): Promise<string> => {
  try {
    // 1. Fetch raw HTML with a realistic User-Agent to prevent bot-blocking
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      timeout: 8000,
    });

    // 2. YouTube Specific Handling
    if (type === 'youtube') {
      const ytMetadata = scrapeYouTubeMetadata(data);
      if (ytMetadata) {
        return ytMetadata;
      }
    }

    // 3. Standard Scraper / Fallback Mechanism using OpenGraph meta tags
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
