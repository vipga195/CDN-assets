// Public origin used for canonical, sitemap and Open Graph URLs. Inlined at build time.
// `||` (not `??`): an unset Docker ARG leaves SITE_URL as an empty string.
export const SITE_URL = process.env.SITE_URL || 'http://localhost:8090'
