import type { Metadata } from "next";
import { ThemeProvider, Toaster, TooltipProvider } from "@keydrop/ui";
import "./globals.css";
import { Geist, DM_Sans } from "next/font/google";
import { cn } from "@/../../packages/ui/src/cn";

const dmSansHeading = DM_Sans({
  subsets: ["latin"],
  variable: "--font-heading",
});

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL("https://keydrop.app"),
  title: {
    default: "Share secrets with expiring links",
    template: "%s | Keydrop",
  },
  description:
    "Create browser-encrypted links for sharing passwords, API keys, and private notes with configurable expiry and view limits.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable, dmSansHeading.variable)}
    >
      <head>
        <meta name="apple-mobile-web-app-title" content="Keydrop" />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
