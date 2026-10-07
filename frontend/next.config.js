/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/",
        destination: "/documents",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8081/api/v1"}/:path*`,
      },
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8081/api/v1"}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
