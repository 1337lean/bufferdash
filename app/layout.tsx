import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://dash.buffer.lol"),
  title: {
    default: "BufferDash",
    template: "%s | BufferDash"
  },
  description: "Self-hosted analytics, security, and server monitoring for tool sites and VPS deployments.",
  icons: {
    icon: "/favicon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#09090f"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
