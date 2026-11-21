import type { Metadata, Viewport } from "next";
import { toModernUzbek } from "@/lib/uzbek-alphabet";
import "./globals.css";
import "./kelishuv.css";
import "./friendly.css";
import "./reference.css";
import "./services.css";
export const metadata: Metadata = {
  title: toModernUzbek("KELISHUV AI — Nizodan kelishuvgacha"),
  description:
    toModernUzbek("Nizolarni tinch va o‘zaro kelishuv orqali hal qilishga birinchi qadam. Dastlabki AI yordami, professional mediator va tushunarli ish jarayoni."),
  applicationName: "KELIŞUV AI",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#174c3c",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
