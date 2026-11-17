import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BHW Child Records",
  description: "Secure child records and barangay reporting for Barangay Health Workers.",
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
      <body>{children}</body>
    </html>
  );
}
