import axios from 'axios';
import * as cheerio from 'cheerio';
import { getErrorMessage } from '../lib/errors.js';
import { env } from '../config/env.js';

// ============ URL Detection ============

function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(url);
}

function isTwitterUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(twitter\.com|x\.com)/i.test(url);
}

// ============ YouTube Scraper ============

function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // youtube.com/watch?v=VIDEO_ID
    const vParam = urlObj.searchParams.get('v');
    if (vParam) {
      return vParam.split('?')[0] ?? null;
    }

    // youtu.be/VIDEO_ID
    if (urlObj.hostname.includes('youtu.be')) {
      const segment = urlObj.pathname.split('/')[1];
      if (!segment) return null;
      return segment.split('?')[0] ?? null;
    }

    // /embed/VIDEO_ID or /shorts/VIDEO_ID
    const pathMatch = urlObj.pathname.match(/\/(embed|shorts)\/([^/?]+)/);
    return pathMatch?.[2] ?? null;
  } catch {
    return null;
  }
}

async function scrapeYouTube(url: string): Promise<string> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return '';

  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${env.YOUTUBE_API_KEY}`;
  const { data } = await axios.get(apiUrl, { timeout: 8000 });

  if (!data.items?.length) return '';

  const { title = '', description = '' } = data.items[0].snippet;
  return `${title}\n\n${description}`.trim();
}

// ============ Twitter/X Scraper ============

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function scrapeTwitter(url: string): Promise<string> {
  const oembedUrl = `https://publish.x.com/oembed?url=${encodeURIComponent(url)}`;
  const { data } = await axios.get(oembedUrl, { timeout: 8000 });

  const authorName = data.author_name || '';
  const html = data.html || '';

  // Check if it's a tweet with content
  if (/<blockquote[^>]*class="twitter-tweet"[^>]*>/i.test(html)) {
    const tweetText = extractTextFromHtml(html);
    return `${authorName}: ${tweetText}`.trim();
  }

  // For profiles/timelines
  return authorName ? `X/Twitter profile: ${authorName}` : '';
}

// ============ Generic HTML Scraper ============

async function scrapeHtml(url: string): Promise<string> {
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
}

// ============ Main Scraper ============

/**
 * Scrapes metadata (title, description) from a URL.
 * - YouTube: Uses Data API v3 for title + description
 * - Twitter/X: Uses oEmbed API
 * - Other URLs: HTML meta tags scraping
 */
export async function scrapeMetadata(url: string): Promise<string> {
  try {
    if (isYouTubeUrl(url)) {
      return await scrapeYouTube(url);
    }

    if (isTwitterUrl(url)) {
      return await scrapeTwitter(url);
    }

    return await scrapeHtml(url);
  } catch (error) {
    console.warn(`Failed to scrape metadata for ${url}:`, getErrorMessage(error));
    return '';
  }
}
