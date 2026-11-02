import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: [
    { path: "./fonts/geist-latin.woff2", weight: "100 900" },
    { path: "./fonts/geist-latin-ext.woff2", weight: "100 900" },
  ],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = localFont({
  src: [
    { path: "./fonts/geist-mono-latin.woff2", weight: "100 900" },
    { path: "./fonts/geist-mono-latin-ext.woff2", weight: "100 900" },
  ],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "My Business by STACK37",
  description: "Your business workspace by STACK37.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
