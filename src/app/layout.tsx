import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Professional Movie Info Extractor",
  description: "Extract precise, structured factual information from text without hallucinations.",
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

