import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EDMS Enterprise — Arkaa digital",
  description: "Enterprise Document Management System by Arkaa digital.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased text-foreground selection:bg-orange-100 selection:text-orange-900">
        {children}
      </body>
    </html>
  );
}
