import type { MetadataRoute } from 'next'
import { SITE_URL } from '../services/lib/site'

// Admin pages stay crawlable so their noindex is seen and /_next assets load for rendering.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
