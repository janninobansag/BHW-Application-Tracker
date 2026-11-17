import type { Metadata } from "next";
import "./globals.css";
import { siteCopy } from "@/Resources/copy";

export const metadata: Metadata = {
  title: siteCopy.title,
  description: siteCopy.description,
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
