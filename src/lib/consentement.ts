/*
 * Témoin de consentement, lu et écrit par tous les sites des bibliothèques qui
 * adoptent ce système (studio.bib.umontreal.ca utilise le même format). Sur
 * bib.umontreal.ca et ses sous-domaines, il est partagé ; ailleurs (localhost,
 * préproduction), il reste propre au site.
 */
export const NOM_TEMOIN = 'bib-consentement'
const DOMAINE_PARTAGE = 'bib.umontreal.ca'
const VERSION = 1
// Le consentement ne vaut que pour une durée limitée (Loi sur l'accès, art. 53.1).
export const DUREE_CONSENTEMENT_MS = 182 * 24 * 60 * 60 * 1000

export interface Choix {
  statistiques: boolean
  date: number
}

/** Choix valide trouvé dans document.cookie, sinon null. */
export function lireChoix(cookies: string, maintenant = Date.now()): Choix | null {
  const brut = cookies
    .split('; ')
    .find((morceau) => morceau.startsWith(`${NOM_TEMOIN}=`))
    ?.slice(NOM_TEMOIN.length + 1)
  if (!brut) return null

  try {
    const valeur = JSON.parse(decodeURIComponent(brut))
    const valide =
      valeur.version === VERSION &&
      (valeur.statistiques === 'accepte' || valeur.statistiques === 'refuse') &&
      maintenant - valeur.date < DUREE_CONSENTEMENT_MS
    return valide ? { statistiques: valeur.statistiques === 'accepte', date: valeur.date } : null
  } catch {
    return null
  }
}

/** Chaîne à donner à document.cookie ; la durée restante suit la date du choix. */
export function formaterTemoin(
  choix: Choix,
  { hostname, protocol }: { hostname: string; protocol: string },
  maintenant = Date.now(),
): string {
  const valeur = encodeURIComponent(
    JSON.stringify({
      statistiques: choix.statistiques ? 'accepte' : 'refuse',
      date: choix.date,
      version: VERSION,
    }),
  )
  const partage = hostname === DOMAINE_PARTAGE || hostname.endsWith(`.${DOMAINE_PARTAGE}`)
  return [
    `${NOM_TEMOIN}=${valeur}`,
    'Path=/',
    `Max-Age=${Math.floor((choix.date + DUREE_CONSENTEMENT_MS - maintenant) / 1000)}`,
    'SameSite=Lax',
    partage && `Domain=${DOMAINE_PARTAGE}`,
    protocol === 'https:' && 'Secure',
  ]
    .filter(Boolean)
    .join('; ')
}
