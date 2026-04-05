import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FactureCheck – Conformité factures électroniques 2026",
  description:
    "Vérifiez en quelques secondes si vos factures respectent les nouvelles obligations légales françaises 2026-2027. Outil no-code gratuit pour freelances et TPE.",
  keywords: [
    "facture électronique",
    "conformité facture",
    "facturation 2026",
    "mentions obligatoires",
    "freelance",
    "TPE",
  ],
  openGraph: {
    title: "FactureCheck – Conformité factures électroniques 2026",
    description:
      "Vérifiez en quelques secondes si vos factures respectent les nouvelles obligations légales françaises 2026-2027.",
    type: "website",
    locale: "fr_FR",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-white text-gray-900 font-sans">
        {children}
      </body>
    </html>
  );
}
