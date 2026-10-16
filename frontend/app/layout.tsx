import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vyuha — Partnership decisions, challenged",
  description:
    "Find unexpected collaboration partners, test the evidence, and challenge recommendations before spending.",
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
