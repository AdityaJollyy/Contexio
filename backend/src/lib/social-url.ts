export interface SocialUrlInfo {
  platform: 'linkedin' | 'twitter' | null;
  author: string; // handle or vanity name, '' if unknown
  snippet: string; // opening words of the post, '' if unavailable
}

const EMPTY: SocialUrlInfo = { platform: null, author: '', snippet: '' };

/**
 * LinkedIn post paths look like:
 *   /posts/<authorHandle>_<slugified-opening-words>-<activityId>-<suffix>
 *
 * The split is on the first `_` because handles themselves contain `-`.
 */
const parseLinkedIn = (url: URL): SocialUrlInfo => {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments[0] !== 'posts' || !segments[1]) return EMPTY;

  const slug = segments[1];
  const separator = slug.indexOf('_');
  if (separator < 1) return { platform: 'linkedin', author: slug, snippet: '' };

  const author = slug.slice(0, separator);
  const tokens = slug.slice(separator + 1).split('-');

  // Everything from the all-numeric activity id onward is machine noise.
  const activityIndex = tokens.findIndex((token) => /^\d+$/.test(token));
  const words = activityIndex === -1 ? tokens : tokens.slice(0, activityIndex);

  return { platform: 'linkedin', author, snippet: words.filter(Boolean).join(' ') };
};

/** x.com/<handle>/status/<id> — the handle is the only text in the path. */
const parseTwitter = (url: URL): SocialUrlInfo => {
  const segments = url.pathname.split('/').filter(Boolean);
  const author = segments[0] ?? '';
  if (!author || author === 'i' || author === 'home') return { ...EMPTY, platform: 'twitter' };
  return { platform: 'twitter', author, snippet: '' };
};

/**
 * Whatever signal the URL path carries, before any network call. For a blocked
 * social post this is all the item has. Does no I/O and never throws.
 */
export const parseSocialUrl = (rawUrl: string): SocialUrlInfo => {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');

    if (hostname === 'linkedin.com' || hostname.endsWith('.linkedin.com')) {
      return parseLinkedIn(url);
    }

    if (hostname === 'x.com' || hostname === 'twitter.com') {
      return parseTwitter(url);
    }

    return EMPTY;
  } catch {
    return EMPTY;
  }
};
