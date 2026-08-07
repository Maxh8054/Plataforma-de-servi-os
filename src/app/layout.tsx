import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import ServiceWorkerRegister from "@/components/sw-register";
import { APP_VERSION } from "@/lib/version";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#ff6600",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "Zamine Plataforma",
  description: "Plataforma de Serviços Zamine Brasil",
  keywords: ["Zamine", "Hitachi", "Serviços", "Manutenção", "Mineração"],
  authors: [{ name: "Max Henrique" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-512.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Zamine Plataforma",
  },
  openGraph: {
    title: "Zamine Plataforma",
    description: "Plataforma de Serviços Zamine Brasil",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Zamine" />
        <meta name="app-version" content={String(APP_VERSION)} />
        <link rel="manifest" href="/manifest.json" />
        <link rel="stylesheet" href="/fonts/material-icons.css" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__APP_VERSION="${APP_VERSION}";`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <ServiceWorkerRegister />
        <Toaster />
      </body>
    </html>
  );
}
