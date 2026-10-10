import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { settingsBootScript } from "@/lib/settings";
import Dashboard from "./dashboard";

const satoshi = localFont({
  variable: "--font-satoshi",
  display: "swap",
  src: [
    { path: "./fonts/Satoshi-Variable.woff2", weight: "300 900", style: "normal" },
    { path: "./fonts/Satoshi-VariableItalic.woff2", weight: "300 900", style: "italic" },
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alchemy Connect",
  description: "Live WebSocket clients from Roblox",
  icons: { icon: "/alchemy.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${satoshi.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* the page handles its own themes: stop Chrome/Edge auto-dark and Dark Reader from recoloring it */}
        <meta name="color-scheme" content="dark light" />
        <meta name="darkreader-lock" />
        <script dangerouslySetInnerHTML={{ __html: settingsBootScript }} />
      </head>
      <body className="h-full bg-bg font-sans text-fg">
        {/* lives in the layout so it (and its WebSocket) stays mounted across / and /clients/{id} */}
        <Dashboard />
        {children}
      </body>
    </html>
  );
}
