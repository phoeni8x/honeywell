/** @type {import('next').NextConfig} */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  // Apex + www: some mobile browsers treat fetch to the API as cross-origin if the page host differs from 'self' in edge cases.
  "connect-src 'self' https://teamruby.net https://www.teamruby.net https://*.supabase.co wss://*.supabase.co https://api.telegram.org https://api.coingecko.com https://api.etherscan.io https://blockstream.info https://*.tile.openstreetmap.org https://tile.openstreetmap.org",
].join("; ");

const nextConfig = {
  async redirects() {
    return [
      { source: "/shops", destination: "/shop", permanent: true },
      { source: "/shops/", destination: "/shop", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  async headers() {
    const securityHeaders = [
      { key: "X-DNS-Prefetch-Control", value: "on" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(self), microphone=(), geolocation=(self)",
      },
    ];
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({ key: "Content-Security-Policy", value: csp });
    }
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
