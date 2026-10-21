import type { NextConfig } from 'next'

const config: NextConfig = {
  basePath: '/admin',
  output: 'standalone',
  experimental: { serverActions: { bodySizeLimit: '21mb' } },
}

export default config