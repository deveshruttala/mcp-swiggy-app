import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components";

export const metadata: Metadata = {
  title: "Swiggy LifeOps Agent",
  description:
    "An AI agent that plans hackathon nights, flat refills, printouts, travel meals, and team lunches — for students, on top of Swiggy MCP.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <Nav />
        <main className="mx-auto max-w-3xl px-4 pb-12 pt-6">{children}</main>
      </body>
    </html>
  );
}
