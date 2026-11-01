/* Guides et bases de données pour la recherche : un seul fichier, chargé au premier usage du champ */
import { listeRecherche } from '@/lib/libguides'

export async function GET() {
  return new Response(JSON.stringify(await listeRecherche()), { headers: { 'Content-Type': 'application/json' } })
}
