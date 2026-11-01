import type { APIRoute } from 'astro'

/* Comme bibweb : seule la production est indexée. SITE_ENV vient de astro.config.mjs. */
export const GET: APIRoute = ({ site }) => {
  const contenu = process.env.SITE_ENV === 'production' ? ['User-agent: *', 'Allow: /', `Sitemap: ${new URL('/sitemap.xml', site).href}`] : ['User-agent: *', 'Disallow: /']
  return new Response(`${contenu.join('\n')}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
