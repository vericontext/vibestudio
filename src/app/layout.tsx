import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VibeStudio",
  description: "Local-first GPT Image 2 and Seedance 2.0 video studio"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

