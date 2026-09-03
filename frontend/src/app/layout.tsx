import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EDRMS - Enterprise Document Repository Management System",
  description: "Enterprise platform for document scanning, OCR, processing, and governance.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        {children}
      </body>
    </html>
  );
}
