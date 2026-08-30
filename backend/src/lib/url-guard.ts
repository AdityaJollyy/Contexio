import dns from 'node:dns';
import { isIPv4 } from 'node:net';

/**
 * The server fetches arbitrary user-supplied URLs. Without this guard a saved
 * link can point at cloud metadata endpoints or anything on the internal
 * network, and the response comes back through the app.
 */

const isPrivateIPv4 = (address: string): boolean => {
  const parts = address.split('.').map(Number);
  const [a, b] = parts;
  if (a === undefined || b === undefined) return true;

  if (a === 0) return true; // 0.0.0.0/8, unspecified
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8, loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16, link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16

  return false;
};

const isPrivateIPv6 = (address: string): boolean => {
  const normalized = address.toLowerCase().split('%')[0] ?? '';

  if (normalized === '::' || normalized === '::1') return true; // unspecified, loopback

  // IPv4-mapped (::ffff:127.0.0.1) is the standard way to smuggle a v4 address.
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isPrivateIPv4(mapped[1]);

  const firstGroup = parseInt(normalized.split(':')[0] || '0', 16);
  if ((firstGroup & 0xfe00) === 0xfc00) return true; // fc00::/7, unique local
  if ((firstGroup & 0xffc0) === 0xfe80) return true; // fe80::/10, link-local

  return false;
};

const isPrivateAddress = (address: string): boolean =>
  isIPv4(address) ? isPrivateIPv4(address) : isPrivateIPv6(address);

/**
 * Throws unless the URL is http(s) and every address it resolves to is public.
 * Must be re-run on each redirect hop — a redirect to 127.0.0.1 is the standard
 * bypass for a check done only on the original URL.
 */
export const assertSafeUrl = async (rawUrl: string): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Not a valid URL: ${rawUrl}`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Blocked URL scheme: ${url.protocol}`);
  }

  const addresses = await dns.promises.lookup(url.hostname, { all: true });
  if (addresses.length === 0) {
    throw new Error(`Could not resolve host: ${url.hostname}`);
  }

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new Error(`Blocked private address for ${url.hostname}: ${address}`);
    }
  }

  return url;
};
