import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Output optimized for Vercel (default)
  reactStrictMode: true,

  // Expose env vars to the client
  env: {
    NEXT_PUBLIC_APP_VERSION: '2.0.0',
  },

  // Allow importing Workers via URL constructor
  webpack(config) {
    config.module.rules.push({
      test: /\.worker\.(js|ts)$/,
      use: { loader: 'worker-loader', options: { inline: 'no-fallback' } },
    })
    return config
  },
}

export default nextConfig
