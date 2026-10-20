import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import { Suspense } from "react";
import { HideOnPublic } from "@/components/app/hide-on-public";
import { SiteHeader } from "@/components/app/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PIO Coverage HQ", template: "%s · PIO Coverage HQ" },
  description: "Coverage tracking for the Provincial Information Office of Camarines Norte.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children, drawer }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        {/* usePathname() needs Suspense on dynamic routes; the fallback is the normal header. */}
        <Suspense fallback={<SiteHeader />}>
          <HideOnPublic>
            <SiteHeader />
          </HideOnPublic>
        </Suspense>
        <div id="main" className="flex flex-1 flex-col">
          {children}
        </div>
        <Suspense fallback={null}>
          <HideOnPublic>
            <footer className="border-t py-4 text-center text-xs text-muted-foreground print:hidden">
              Public coverage request form:{" "}
              <Link href="/request" className="font-medium text-foreground underline underline-offset-4">
                /request
              </Link>{" "}
              (share this link with LGUs and organisers)
            </footer>
          </HideOnPublic>
        </Suspense>
        {drawer}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
