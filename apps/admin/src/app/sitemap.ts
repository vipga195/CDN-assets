import type { MetadataRoute } from 'next'
import { SITE_URL } from '../services/lib/site'

// Only public, indexable pages; the admin pages are noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL }, { url: `${SITE_URL}/docs` }]
}
