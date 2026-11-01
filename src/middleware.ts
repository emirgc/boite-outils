/* Au rendu de chaque page, y compris au build : les liens de la coquille et ceux des guides passent par la même règle. */
import { defineMiddleware } from 'astro:middleware'
import { marquerLiensExternes } from '@/lib/liens-externes'

export const onRequest = defineMiddleware(async (_, suite) => {
  const reponse = await suite()
  if (!reponse.headers.get('content-type')?.includes('text/html')) return reponse
  return new Response(marquerLiensExternes(await reponse.text()), reponse)
})
