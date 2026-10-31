// Pure helpers for the typhoon track annotator (/typhoon): which links the
// image proxy may fetch, and the geometry the canvas draws.

/** PAGASA's sites. The proxy fetches images from these hosts and their subdomains only. */
export const PAGASA_HOSTS = ["panahon.gov.ph", "pagasa.dost.gov.ph"] as const;

/** Image types the proxy passes through. No SVG: it would be served from our own origin and can carry script. */
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"] as const;

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export function isPagasaHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return PAGASA_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * The link as a URL when the proxy may fetch it: https, a PAGASA host, the
 * default port and no credentials. Otherwise a sentence saying what's wrong.
 */
export function checkImageUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, error: "That isn't a link. Copy the image address and try again." };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Only https links can be loaded." };
  if (url.username || url.password || (url.port && url.port !== "443")) {
    return { ok: false, error: "That link can't be loaded." };
  }
  if (!isPagasaHost(url.hostname)) {
    return { ok: false, error: "Only images from PAGASA (panahon.gov.ph or pagasa.dost.gov.ph) can be loaded by link. Save other images and upload them instead." };
  }
  return { ok: true, url };
}

/** The bare media type of a content-type header, lowercased. */
export function mediaType(contentType: string | null): string {
  return (contentType ?? "").split(";")[0].trim().toLowerCase();
}

export function isAllowedImageType(contentType: string | null): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mediaType(contentType));
}

// ---------- Drawing ----------

export type Point = { x: number; y: number };
export type Tool = "pen" | "arrow" | "line" | "ellipse" | "rect" | "text";

type Style = { color: string; width: number };
export type Shape =
  | (Style & { kind: "pen"; points: Point[] })
  | (Style & { kind: "arrow" | "line" | "ellipse" | "rect"; a: Point; b: Point })
  | (Style & { kind: "text"; at: Point; text: string });

/**
 * One unit of stroke width, in image pixels. Sizes are picked in units so a
 * "medium" line looks the same on a 600px screenshot and a 4000px chart.
 */
export function strokeUnit(width: number, height: number): number {
  return Math.max(1, Math.max(width, height) / 1000);
}

/** The two far corners of an arrowhead pointing at `to`. Empty when the arrow has no length. */
export function arrowHead(from: Point, to: Point, size: number): [Point, Point] | [] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return [];
  const angle = Math.atan2(dy, dx);
  const spread = Math.PI / 7;
  return [
    { x: to.x - size * Math.cos(angle - spread), y: to.y - size * Math.sin(angle - spread) },
    { x: to.x - size * Math.cos(angle + spread), y: to.y - size * Math.sin(angle + spread) },
  ];
}

/** Top-left corner and size of the box two points span, whichever way it was dragged. */
export function boxOf(a: Point, b: Point): { x: number; y: number; w: number; h: number } {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
}

/** A point on screen (client coords) mapped into the image, given where the image is drawn. */
export function toImagePoint(
  client: Point,
  rect: { left: number; top: number; width: number; height: number },
  image: { width: number; height: number },
): Point {
  const x = ((client.x - rect.left) / rect.width) * image.width;
  const y = ((client.y - rect.top) / rect.height) * image.height;
  return { x: Math.min(Math.max(x, 0), image.width), y: Math.min(Math.max(y, 0), image.height) };
}

/** True when a dragged shape is too small to be anything but a stray click. */
export function isTooSmall(shape: Shape, unit: number): boolean {
  if (shape.kind === "text") return shape.text.trim() === "";
  if (shape.kind === "pen") return shape.points.length < 2;
  return Math.hypot(shape.b.x - shape.a.x, shape.b.y - shape.a.y) < 3 * unit;
}

/** The downloaded file's name, e.g. typhoon-track-2026-10-31.png. */
export function exportFileName(manilaDay: string): string {
  return `typhoon-track-${manilaDay}.png`;
}
