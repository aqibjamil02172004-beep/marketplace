// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // your Supabase public bucket
      {
        protocol: 'https',
        hostname: 'nzbtgoqdcugqviiichbg.supabase.co',
      },
      // Google thumbnails (if you show them)
      { protocol: 'https', hostname: 'encrypted-tbn0.gstatic.com' },
      // Apple newsroom / product images
      { protocol: 'https', hostname: 'www.apple.com' },
      { protocol: 'https', hostname: 'store.storeimages.cdn-apple.com' },
      // (optional) common hosts you’ve used
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: 'i.imgur.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};

export default nextConfig;
