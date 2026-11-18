import type { Metadata, Viewport } from "next";
import "./globals.css";
import { siteCopy } from "@/Resources/copy";
import { PwaServiceWorker } from "@/Client/views/components/pwa-service-worker";

export const metadata: Metadata = {
  title: siteCopy.title,
  description: siteCopy.description,
  applicationName: "BHW Records",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "BHW Records",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#166f62",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <PwaServiceWorker />
        {children}
      </body>
    </html>
  );
}
