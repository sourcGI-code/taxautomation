import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { firmDisplayName, FIRM } from "@/lib/firm";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const practiceName = firmDisplayName();

export const metadata: Metadata = {
  title: {
    default: `${practiceName} | Tax Preparation in Wabash, IN`,
    template: `%s | ${practiceName}`,
  },
  description: `${practiceName} — Ken Collins. Trusted tax preparation at ${FIRM.fullAddress}. Book online, upload documents securely, and track your return.`,
  openGraph: {
    title: `${practiceName} | Wabash, Indiana`,
    description: `Tax preparation with Ken Collins. ${FIRM.rating} Google rating. ${FIRM.fullAddress}.`,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50">{children}</body>
    </html>
  );
}
