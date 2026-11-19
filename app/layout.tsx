import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../public/records-ui.css";
import "../public/civic-workspace.css";
import "../public/timbang-ui.css";
import { siteCopy } from "@/Resources/copy";
import { PwaServiceWorker } from "@/Client/views/components/pwa-service-worker";

export const metadata: Metadata = {
  title: siteCopy.title,
  description: siteCopy.description,
  applicationName: "BHW Records",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-bhw.png", sizes: "64x64", type: "image/png" },
      { url: "/icons/bhw-records-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/bhw-records-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon-bhw.png",
    apple: "/icons/bhw-records-apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "BHW Records",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#166f62",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
