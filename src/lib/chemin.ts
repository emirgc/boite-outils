/* Préfixe d'un site publié dans un sous-dossier (GitHub Pages) : vide partout ailleurs. Le HTML est préfixé en fin de build (integrations/base-sous-dossier.mjs) ; ceci sert au code qui fabrique ou compare une adresse. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

export const avecBase = (adresse: string) => `${BASE}${adresse}`
export const sansBase = (chemin: string) => (chemin.startsWith(`${BASE}/`) ? chemin.slice(BASE.length) : chemin)
