/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Container images build with NEXT_OUTPUT=standalone to ship a minimal server bundle.
  ...(process.env.NEXT_OUTPUT === 'standalone' ? { output: 'standalone' } : {}),
};

module.exports = nextConfig;
