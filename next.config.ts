import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['nodemailer'],
  allowedDevOrigins: ['127.0.0.1', 'localhost', '**.space-z.ai', 'preview-chat-48f2a45e-9282-4069-ae67-8b6dc041c109.space-z.ai'],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
