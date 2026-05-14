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
