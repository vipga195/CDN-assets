import type { MetadataRoute } from 'next'
import { SITE_URL } from '../lib/site'

// Only public, indexable pages; the admin pages are noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/docs` }]
}
