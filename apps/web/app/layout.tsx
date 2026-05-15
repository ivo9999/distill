import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "@fontsource/adwaita-sans/400.css";
import "@fontsource/adwaita-sans/500.css";
import "@fontsource/adwaita-sans/600.css";
import "@fontsource/adwaita-sans/700.css";
import "@fontsource/adwaita-sans/900.css";
import "@fontsource/adwaita-sans/400-italic.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Distill",
  description: "Your Discord wrote your newsletter this week.",
  icons: {
    // Browser tab + bookmark bar. SVG is sharp at every size and pulls
    // the brand droplet straight from public/icon.svg.
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    // iOS Add-to-Home-Screen + macOS pinned-tab. Uses the rounded-square
    // app-icon variant (white droplet on brand-purple field) so the
    // mark reads at small sizes on a coloured home-screen background.
    apple: [
      { url: "/apple-touch-icon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
