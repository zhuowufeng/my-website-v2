import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fix workspace root for multi-lockfile environment
  turbopack: {
    root: process.cwd(),
  },

  // Output standalone for Zeabur deployment
  output: "standalone",

  // ======== Image Optimization ========
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // ======== Compression ========
  compress: true,

  // ======== Page Performance ========
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  trailingSlash: false,
  skipTrailingSlashRedirect: true,

  // ======== Server-side Configuration ========
  serverExternalPackages: ["bcryptjs"],

  // ======== Security & Caching Headers ========
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Aggressive caching for static assets (images, fonts, etc.)
      {
        source: "/:path*(.svg|.png|.jpg|.jpeg|.gif|.webp|.avif|.ico)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      // Cache font files aggressively
      {
        source: "/:path*(.woff|.woff2|.ttf|.otf|.eot)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
