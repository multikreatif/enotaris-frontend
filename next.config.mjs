/** @type {import('next').NextConfig} */
const nextConfig = {
  // Base path: kosong = app di root (/). Set NEXT_PUBLIC_BASE_PATH untuk deploy di subpath.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',

  // Asset prefix: sama dengan base path
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH ?? '',

  // Standalone output for Docker deployment
  output: 'standalone',
};

export default nextConfig;
