import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hidden Preference Elicitation — Ambiguity-First Travel Planner",
  description: "Helping users discover what matters before we plan: detect latent preference gaps, ask high-impact checkpoints, and build a preference-aware itinerary."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
