import type { Metadata } from "next";
import { Caveat, Fraunces } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "700", "800", "900"], variable: "--font-fraunces" });
const caveat = Caveat({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-caveat" });

export const metadata: Metadata = {
  title: "TripTree - Interruptible Trip Planning",
  description: "Watch a trip plan branch, pause at meaningful decisions, prune alternatives, steer from checkpoints, and continue without restarting."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${caveat.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
