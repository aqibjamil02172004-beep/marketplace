// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase public bucket
      {
        protocol: 'https',
        hostname: 'nzbtgoqdcugqviiichbg.supabase.co',
        pathname: '/**',
      },

      // Google thumbnails
      {
        protocol: 'https',
        hostname: 'encrypted-tbn0.gstatic.com',
        pathname: '/**',
      },

      // Apple images
      {
        protocol: 'https',
        hostname: 'www.apple.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'store.storeimages.cdn-apple.com',
        pathname: '/**',
      },

      // External product images
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },

      // ✅ FIX FOR YOUR ERROR
      {
        protocol: 'https',
        hostname: 'www.ur.co.uk',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
