import { NextResponse, type NextRequest } from "next/server";

// Optional view key. When VIEW_KEY is set, read-only viewers must open the app
// once with ?k=<VIEW_KEY>; a long-lived cookie then remembers the device. The
// public request form stays open to everyone.

const COOKIE = "pio_view";
const MAX_AGE = 60 * 60 * 24 * 180;

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`view:${value}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function proxy(request: NextRequest) {
  const viewKey = process.env.VIEW_KEY;
  if (!viewKey) return NextResponse.next();

  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/request" || pathname.startsWith("/request/")) return NextResponse.next();

  const expected = await sha256(viewKey);
  const supplied = searchParams.get("k");

  if (supplied !== null) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("k");
    if ((await sha256(supplied)) !== expected) {
      return new NextResponse("This link is not valid. Ask the PIO for the current link.", { status: 403 });
    }
    const res = NextResponse.redirect(url);
    res.cookies.set(COOKIE, expected, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
    return res;
  }

  if (request.cookies.get(COOKIE)?.value === expected) return NextResponse.next();

  return new NextResponse("Open PIO Production with the link shared by the office.", {
    status: 401,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|icon.svg).*)"],
};
