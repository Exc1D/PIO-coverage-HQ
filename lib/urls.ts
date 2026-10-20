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

/** Same shape as the database's post_link CHECK, so the app never accepts a link the DB rejects. */
const FACEBOOK_PATTERN = /^https:\/\/((www|m|web|business|mbasic)\.)?(facebook\.com|fb\.watch)\/\S+$/i;

/** A Facebook post URL on facebook.com (or a subdomain we know) or fb.watch, with a path. */
export function isFacebookPostUrl(value: string): boolean {
  const raw = value.trim();
  const url = parseHttps(raw);
  return (
    url !== null &&
    FACEBOOK_HOSTS.has(url.hostname.toLowerCase()) &&
    url.pathname.length > 1 &&
    FACEBOOK_PATTERN.test(raw)
  );
}

export function isHttpsUrl(value: string): boolean {
  return parseHttps(value) !== null;
}
