/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: import.meta.dirname,
  async rewrites() {
    return [{ source: "/", destination: "/dashboard.html" }];
  },
};

export default nextConfig;
