import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assumption-Aware Agent Planner",
  description: "A multi-agent travel planner that reveals assumptions before planning."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
