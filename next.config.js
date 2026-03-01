/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['@google-cloud/bigquery', '@google-cloud/storage'],
  },
}
module.exports = nextConfig
