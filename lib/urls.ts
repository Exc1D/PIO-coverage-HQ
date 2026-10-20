const FACEBOOK_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "web.facebook.com",
  "business.facebook.com",
  "mbasic.facebook.com",
  "fb.watch",
]);

function parseHttps(value: string): URL | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** A Facebook post URL on facebook.com (or a subdomain we know) or fb.watch, with a path. */
export function isFacebookPostUrl(value: string): boolean {
  const url = parseHttps(value);
  return url !== null && FACEBOOK_HOSTS.has(url.hostname.toLowerCase()) && url.pathname.length > 1;
}

export function isHttpsUrl(value: string): boolean {
  return parseHttps(value) !== null;
}
