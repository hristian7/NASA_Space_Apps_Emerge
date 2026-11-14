import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { defaultLook, lookBootScript } from "@/lib/ui/look";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emerge",
  description: "Twenty five years of satellite fire data as one fire calendar, for any place on Earth.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const fonts =
  "https://fonts.googleapis.com/css2?family=Familjen+Grotesk:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Condensed:wght@400;500;600&family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Public+Sans:wght@400;500;600&display=swap";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  // The inline script in the head applies a remembered look to <html> before
  // React starts, so that element's attributes do not match the ones rendered
  // on the server. The difference is intended, and suppressing the warning on
  // this one element is how React is told so.
  return (
    <html
      lang={locale}
      data-look={defaultLook}
      data-sheet="half"
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={fonts} />
        {/* Applies a remembered look before the first paint. */}
        <script dangerouslySetInnerHTML={{ __html: lookBootScript }} />
      </head>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
