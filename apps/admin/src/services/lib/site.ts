// Public origin used for canonical, sitemap and Open Graph URLs. Inlined at build time.
// `||` (not `??`): an unset Docker ARG leaves SITE_URL as an empty string.
export const SITE_URL = process.env.SITE_URL || 'http://localhost:8090'

// Site images are served by the CDN itself. Ids are image ids uploaded in the admin; inlined at build time.
const CDN = process.env.NEXT_PUBLIC_CDN_URL || 'http://localhost:8090'
export const LOGO_ID = process.env.NEXT_PUBLIC_LOGO_ID || ''
export const OG_IMAGE_ID = process.env.NEXT_PUBLIC_OG_IMAGE_ID || ''

export function cdnImageUrl(id: string, w: number, fmt?: 'orig'): string {
  return `${CDN}/i/${id}?w=${w}${fmt ? `&fmt=${fmt}` : ''}`
}
