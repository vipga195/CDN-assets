import type { NextConfig } from 'next'

const config: NextConfig = {
  output: 'standalone',
  experimental: { serverActions: { bodySizeLimit: '21mb' } },
}

export default config