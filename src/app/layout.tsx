import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import QueryProvider from "@/components/query-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plataforma de Serviços — Zamine Brasil",
  description: "Plataforma de gestão de serviços, equipamentos e demandas da Zamine Brasil.",
  keywords: ["Zamine", "serviços", "mineração", "equipamentos", "gestão"],
  authors: [{ name: "Zamine Brasil" }],
  icons: {
    icon: "/zamine-logo.png",
  },
  openGraph: {
    title: "Plataforma de Serviços — Zamine Brasil",
    description: "Gestão de serviços, equipamentos e demandas",
    siteName: "Zamine Brasil",
    type: "website",
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
        <QueryProvider>
          {children}
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
