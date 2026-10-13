import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/reports/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Z-Services AI - Sistema de Relatórios",
  description: "Sistema de relatórios de inspeção e falhas com colaboração em tempo real, exportação para PowerPoint e Excel.",
  keywords: ["Z-Services", "relatórios", "inspeção", "falhas", "colaboração", "Next.js", "TypeScript"],
  authors: [{ name: "Z-Services AI Team" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Z-Services AI",
    description: "Sistema de relatórios de inspeção e falhas",
    url: "https://z-services.ai",
    siteName: "Z-Services AI",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Z-Services AI",
    description: "Sistema de relatórios de inspeção e falhas",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
        </Providers>
        <Toaster />
      </body>
    </html>
  );
}
