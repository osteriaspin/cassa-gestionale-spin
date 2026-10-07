import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import GestionaleHeader from "@/components/GestionaleHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestionale Ristorante",
  description: "Gestionale ristorante",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-gray-100 text-gray-900">

        <GestionaleHeader />

        <div className="flex-1">
          {children}
        </div>

      </body>
    </html>
  );
}