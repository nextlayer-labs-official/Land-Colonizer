/** @type {import('next').NextConfig} */
const BACKEND_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: `${BACKEND_ORIGIN}/uploads/:path*`,
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
