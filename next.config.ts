import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow access from local network in development
  experimental: {
    allowedDevOrigins: ['*'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'd1o9iute5tpibz.cloudfront.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      // Add S3 bucket domains for images
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.s3.*.amazonaws.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply these headers to all routes in your API an auth paths
        source: "/(api|auth)/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Cookie, Set-Cookie" },
          { key: "Access-Control-Allow-Origin", value: process.env.NODE_ENV === 'production' ? (process.env.NEXT_PUBLIC_APP_EDITOR_URL || 'https://app.keycraft.org') : (process.env.NEXT_PUBLIC_APP_EDITOR_URL || 'http://app.keycraft.org:3001') },
          { key: "Access-Control-Expose-Headers", value: "Set-Cookie" },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // Basic script sources
              // ADDED: Allow images and media from your CloudFront CDN
              "img-src 'self' data: https://d1o9iute5tpibz.cloudfront.net",
              "media-src 'self' https://d1o9iute5tpibz.cloudfront.net https://keycraft-midi-library.s3.us-east-2.amazonaws.com https://*.s3.amazonaws.com https://*.s3.*.amazonaws.com",
              "connect-src 'self' https://keycraft-midi-library.s3.us-east-2.amazonaws.com https://*.s3.amazonaws.com https://*.s3.*.amazonaws.com",
              "style-src 'self' 'unsafe-inline'", // Basic style sources
              "font-src 'self'", // Basic font sources
              "object-src 'none'", // Disallow plugins like Flash
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          // You can add other global headers here if needed
          // {
          //   key: 'X-Content-Type-Options',
          //   value: 'nosniff',
          // },
        ],
      },
    ];
  },
};

export default nextConfig;
