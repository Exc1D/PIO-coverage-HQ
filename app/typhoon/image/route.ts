import type { NextRequest } from "next/server";
import { checkImageUrl, isAllowedImageType, MAX_IMAGE_BYTES, mediaType } from "@/lib/typhoon";

// GET /typhoon/image?url=<PAGASA image link>
//
// Fetches a track map from PAGASA for the annotator. The browser can't draw a
// cross-origin image onto a canvas and still export it, so it comes through
// here. Only PAGASA hosts, only raster images, redirects checked hop by hop.

const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;

const fail = (status: number, error: string) =>
  Response.json({ error }, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw) return fail(400, "Paste the image's link first.");

  let checked = checkImageUrl(raw);
  if (!checked.ok) return fail(400, checked.error);

  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let res: Response;
  try {
    for (let hop = 0; ; hop++) {
      res = await fetch(checked.url, {
        redirect: "manual",
        signal,
        cache: "no-store",
        headers: { accept: "image/png,image/jpeg,image/gif,image/webp;q=0.9,*/*;q=0.1" },
      });
      if (res.status < 300 || res.status >= 400) break;
      const next = res.headers.get("location");
      if (!next || hop >= MAX_REDIRECTS) return fail(502, "PAGASA's server sent too many redirects.");
      checked = checkImageUrl(new URL(next, checked.url).toString());
      if (!checked.ok) return fail(400, "That link redirects away from PAGASA, so it can't be loaded.");
    }
  } catch {
    return fail(504, "Couldn't reach PAGASA. Check the link, or save the image and upload it instead.");
  }

  if (!res.ok) return fail(502, `PAGASA answered with an error (${res.status}). The image may have moved; copy its link again.`);

  const type = mediaType(res.headers.get("content-type"));
  if (type === "text/html") {
    return fail(415, "That link is a web page, not an image. Right-click the track map and choose \"Copy image address\".");
  }
  if (!isAllowedImageType(type)) return fail(415, "That link isn't a PNG, JPEG, GIF or WebP image.");

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_IMAGE_BYTES) return fail(413, "That image is too large (over 15 MB).");

  const body = await readCapped(res, MAX_IMAGE_BYTES);
  if (!body) return fail(413, "That image is too large (over 15 MB).");

  return new Response(body, {
    headers: {
      "content-type": type,
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}

/** The whole body, or null once it passes `limit` bytes. */
async function readCapped(res: Response, limit: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
