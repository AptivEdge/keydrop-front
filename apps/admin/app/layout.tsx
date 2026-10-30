import type { Metadata } from "next";
import { ThemeProvider, TooltipProvider } from "@keydrop/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Keydrop Admin",
  description: "Internal operations console for Keydrop staff.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-title" content="Keydrop Admin" />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
