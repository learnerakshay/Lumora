import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AppProviders } from "@/providers/app-providers";

export const metadata: Metadata = {
  title: { default: "Lumora — Illuminate Knowledge", template: "%s | Lumora" },
  description: "Lumora is a calm workspace for research and learning.",
  openGraph: {
    title: "Lumora — Illuminate Knowledge",
    description: "A calm workspace for research and learning.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Lumora — Illuminate Knowledge",
    description: "A calm workspace for research and learning.",
  },
};

export const viewport: Viewport = { themeColor: "#09090B" };

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
