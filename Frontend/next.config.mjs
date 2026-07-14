/** @type {import('next').NextConfig} */
const BACKEND_INTERNAL = process.env.BACKEND_INTERNAL_URL || 'http://localhost:4000';

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: `${BACKEND_INTERNAL}/uploads/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',  value: 'nosniff' },
          { key: 'X-Frame-Options',          value: 'DENY' },
          { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',       value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
