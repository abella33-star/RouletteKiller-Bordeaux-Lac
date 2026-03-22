import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: '2.0.0',
  },
}

export default nextConfig
