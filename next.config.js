/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: '**.supabase.co' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@google-cloud/bigquery', '@google-cloud/storage'],
  },
}
module.exports = nextConfig
