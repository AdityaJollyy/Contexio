import axios, { type AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { getErrorMessage } from '../lib/errors.js';
import { env } from '../config/env.js';
import { assertSafeUrl } from '../lib/url-guard.js';
import { parseSocialUrl } from '../lib/social-url.js';

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * A User-Agent on its own is a fingerprint: real Chrome never sends it alone.
 * Accept-Encoding is deliberately absent — axios negotiates and unwraps
 * compression itself, and overriding it risks Brotli reaching Readability as
 * garbled text rather than as an error.
 */
const BROWSER_HEADERS = {
  'User-Agent': BROWSER_USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

const MAX_REDIRECTS = 3;

// Below this, an extraction is treated as having produced nothing usable.
const MIN_USEFUL_CHARS = 200;

/** A block is permanent. Retrying it five times with backoff buys nothing. */
const PERMANENT_STATUSES = [401, 403];

export interface ScrapeResult {
  text: string;
  /** The page could not be read, so `text` is only what the URL gave away. */
  partial: boolean;
}

const isPermanentBlock = (error: unknown): boolean =>
  axios.isAxiosError(error) && PERMANENT_STATUSES.includes(error.response?.status ?? 0);

/**
 * The host and the readable words in the path, with no network call. For a page
 * that cannot be read this is all the item has, and it is usually enough: a
 * recipe URL still says "braised short ribs".
 */
const describeUrl = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./i, '');
    const words = decodeURIComponent(url.pathname)
      .split(/[/\-_.+%]+/)
      .filter((token) => token.length > 1 && !/^\d+$/.test(token))
      .filter((token) => !/^(html?|php|aspx?|amp|index)$/i.test(token))
      .join(' ');

    return words ? `${host} — ${words}` : host;
  } catch {
    return '';
  }
};

function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(url);
}

function isTwitterUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(twitter\.com|x\.com)/i.test(url);
}

function isLinkedInUrl(url: string): boolean {
  return /^https?:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com/i.test(url);
}

/**
 * Fetches a URL through the SSRF guard, following redirects by hand so the
 * guard re-runs on every hop. Automatic redirects would let a public host
 * bounce the request straight to 127.0.0.1.
 */
async function safeFetch(rawUrl: string): Promise<AxiosResponse<string>> {
  let target = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const url = await assertSafeUrl(target);

    const response = await axios.get<string>(url.toString(), {
      headers: BROWSER_HEADERS,
      timeout: env.SCRAPER_TIMEOUT_MS,
      maxContentLength: env.SCRAPER_MAX_BYTES,
      maxRedirects: 0,
      responseType: 'text',
      validateStatus: (status) => status >= 200 && status < 400,
    });

    if (response.status < 300) return response;

    const location = response.headers['location'];
    if (typeof location !== 'string' || !location) {
      throw new Error(`Redirect with no Location header from ${target}`);
    }

    target = new URL(location, url).toString();
  }

  throw new Error(`Too many redirects for ${rawUrl}`);
}

function extractYouTubeVideoId(url: string): string | null {
  try {
    const urlObj = new URL(url);

    const vParam = urlObj.searchParams.get('v');
    if (vParam) return vParam;

    if (urlObj.hostname.includes('youtu.be')) {
      return urlObj.pathname.split('/')[1] ?? null;
    }

    const pathMatch = urlObj.pathname.match(/\/(embed|shorts)\/([^/?]+)/);
    return pathMatch?.[2] ?? null;
  } catch {
    return null;
  }
}

async function scrapeYouTube(url: string): Promise<string> {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return '';

  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(videoId)}&key=${env.YOUTUBE_API_KEY}`;
  const { data } = await axios.get(apiUrl, { timeout: env.SCRAPER_TIMEOUT_MS });

  const snippet = data?.items?.[0]?.snippet;
  if (!snippet) return '';

  const title = typeof snippet.title === 'string' ? snippet.title : '';
  const description = typeof snippet.description === 'string' ? snippet.description : '';
  // The channel is often the only thing remembered about a video, so it is
  // indexed alongside the title.
  const channelTitle = typeof snippet.channelTitle === 'string' ? snippet.channelTitle : '';

  return `${title}\n\n${channelTitle}\n\n${description}`.trim();
}

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

/**
 * X serves a client-rendered SPA, so its HTML holds no post text; oEmbed does,
 * without a key. A protected, deleted or rate-limited post is a normal outcome
 * and must not throw, or it burns five retries on something permanent.
 */
async function scrapeTwitter(url: string): Promise<string> {
  const { author } = parseSocialUrl(url);
  const fallback = author ? `X post by @${author}` : 'X post';

  try {
    const oembedUrl = `https://publish.x.com/oembed?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(oembedUrl, { timeout: env.SCRAPER_TIMEOUT_MS });

    const authorName = typeof data?.author_name === 'string' ? data.author_name : author;
    const html = typeof data?.html === 'string' ? data.html : '';

    if (/<blockquote[^>]*class="twitter-tweet"[^>]*>/i.test(html)) {
      const tweetText = extractTextFromHtml(html);
      if (tweetText.length > 0) return `${authorName}: ${tweetText}`.trim();
    }

    return authorName ? `X post by @${authorName}` : fallback;
  } catch (error) {
    console.warn(`X oEmbed unavailable for ${url}:`, getErrorMessage(error));
    return fallback;
  }
}

/** HTTP 999 is LinkedIn's non-standard "you are not a browser" response. */
function isBlockedLinkedInResponse(response: AxiosResponse<string>): boolean {
  if ([403, 429, 999].includes(response.status)) return true;

  const finalUrl = String(response.request?.res?.responseUrl ?? '');
  return /authwall|\/login/i.test(finalUrl);
}

/**
 * LinkedIn blocks datacenter IP ranges as policy, so a blocked read is the
 * expected case here rather than a failure.
 *
 * It needs its own handler rather than the article path because Readability
 * parses an authwall into convincing sign-in boilerplate, which would give every
 * blocked item a near-identical vector built from login furniture.
 */
async function scrapeLinkedIn(url: string): Promise<string> {
  const { author, snippet } = parseSocialUrl(url);
  const heading = author ? `LinkedIn post by ${author}` : 'LinkedIn post';

  let fetchedText = '';
  try {
    const response = await safeFetch(url);

    if (!isBlockedLinkedInResponse(response)) {
      const $ = cheerio.load(response.data);

      const title = $('meta[property="og:title"]').attr('content') ?? '';
      const description = $('meta[property="og:description"]').attr('content') ?? '';

      let structured = '';
      const ldJson = $('script[type="application/ld+json"]').first().text();
      if (ldJson) {
        try {
          const parsed = JSON.parse(ldJson);
          const text = parsed?.articleBody ?? parsed?.text ?? parsed?.description;
          if (typeof text === 'string') structured = text;
        } catch {
          // Malformed ld+json is common and not worth failing over.
        }
      }

      fetchedText = [title, description, structured]
        .map((part) => part.trim())
        .filter(Boolean)
        .join('\n\n');
    }
  } catch (error) {
    // One attempt, no retries: a block will block again.
    console.warn(`LinkedIn read unavailable for ${url}:`, getErrorMessage(error));
  }

  if (fetchedText.length > MIN_USEFUL_CHARS) return `${heading}\n\n${fetchedText}`;
  if (snippet) return `${heading}\n\n${snippet}`;
  return heading;
}

/**
 * Everything that is not YouTube, LinkedIn or X. Readability strips navigation,
 * sidebars, ads and comments, which usually yields the whole article body
 * instead of a 200-character meta description.
 */
async function scrapeArticle(url: string, finalAttempt: boolean): Promise<ScrapeResult> {
  let html: string;
  try {
    html = (await safeFetch(url)).data;
  } catch (error) {
    // A 401 or 403 is the site's settled answer and degrades immediately. A
    // timeout, DNS failure or 5xx is rethrown for BullMQ to retry, and degrades
    // only once the attempts are spent.
    if (!isPermanentBlock(error) && !finalAttempt) throw error;

    console.warn(`Article read unavailable for ${url}:`, getErrorMessage(error));
    return { text: describeUrl(url), partial: true };
  }

  let dom: JSDOM | null = null;
  try {
    dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();

    const body = article?.textContent?.trim() ?? '';
    if (body.length > MIN_USEFUL_CHARS) {
      return { text: `${article?.title ?? ''}\n\n${body}`.trim(), partial: false };
    }
  } catch (error) {
    console.warn(
      `Readability failed for ${url}, falling back to meta tags:`,
      getErrorMessage(error)
    );
  } finally {
    // jsdom leaks otherwise, and this runs in a long-lived worker process.
    dom?.window.close();
  }

  // JS-rendered pages, paywalls and mostly-media pages land here: thinner, but
  // still saved and still findable.
  const $ = cheerio.load(html);
  const title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';
  const description =
    $('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') ||
    '';

  return { text: `${title.trim()}. ${description.trim()}`.trim(), partial: false };
}

/**
 * Best-effort. A source that yields little returns what it has, and one that
 * cannot be read returns what the URL gave away: extraction never fails a save.
 * Only transient failures throw, and only while BullMQ has an attempt left.
 */
export async function scrapeMetadata(url: string, finalAttempt = true): Promise<ScrapeResult> {
  let result: ScrapeResult;

  if (isYouTubeUrl(url)) {
    result = { text: await scrapeYouTube(url), partial: false };
  } else if (isTwitterUrl(url)) {
    result = { text: await scrapeTwitter(url), partial: false };
  } else if (isLinkedInUrl(url)) {
    result = { text: await scrapeLinkedIn(url), partial: false };
  } else {
    result = await scrapeArticle(url, finalAttempt);
  }

  return { text: result.text.slice(0, env.SCRAPER_MAX_CHARS), partial: result.partial };
}
