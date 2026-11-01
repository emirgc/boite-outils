const SUGGESTIONS_MAX = 8

// NFD ne décompose pas les ligatures : « oeuvre » doit trouver « œuvre »
export const normaliser = (texte: string) => texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae')

/** Guides et bases dont le nom ou un autre nom contient tous les mots cherchés, ceux qui commencent par la recherche d'abord */
export function filtrerGuides<T extends { nom: string; autres?: string }>(guides: T[], recherche: string) {
  const cherche = normaliser(recherche).trim()
  if (!cherche) return []
  const mots = cherche.split(/\s+/)
  return guides
    .filter((guide) => mots.every((mot) => normaliser(`${guide.nom} ${guide.autres ?? ''}`).includes(mot)))
    .sort((a, b) => Number(normaliser(b.nom).startsWith(cherche)) - Number(normaliser(a.nom).startsWith(cherche)) || a.nom.localeCompare(b.nom, 'fr'))
    .slice(0, SUGGESTIONS_MAX)
}

export interface FiltresBases {
  q: string
  s: string
  t: string
  v: string
}

export interface EntreeBase {
  /** Mots du titre et mots de toute la fiche, normalisés */
  titre: string[]
  mots: string[]
  /** Identifiant du groupe de la liste : lettre-a, lettre-b… */
  groupe: string
  s: string[]
  t: string[]
  v: string[]
}

export const motsDe = (texte: string) => normaliser(texte).match(/[\p{L}\p{N}]+/gu) ?? []

/** Chaque mot cherché commence un mot de la fiche : « tair » ne trouve pas « documentaire » */
const correspond = (mots: string[], cherches: string[]) => cherches.every((cherche) => mots.some((mot) => mot.startsWith(cherche)))

const CHOIX = ['s', 't', 'v'] as const

export interface EntreeRecherche {
  titre: string
  /** Page du guide ; absente pour un portail ou l'accueil */
  page?: string
  url: string
  extrait?: string
  /** Mots normalisés du titre et du contenu, séparés par des espaces */
  mots: string
  base?: boolean
}

/** Page de résultats : titre qui commence par la recherche, puis tous les mots dans le titre, puis dans le nom de la page, puis le contenu */
export function chercher<T extends EntreeRecherche>(entrees: T[], recherche: string) {
  const cherches = motsDe(recherche)
  if (!cherches.length) return []
  const debut = cherches.join(' ')
  const score = (entree: T) => {
    const titre = motsDe(entree.titre)
    if (titre.join(' ').startsWith(debut)) return 3
    if (correspond(titre, cherches)) return 2
    return correspond(motsDe(`${entree.titre} ${entree.page ?? ''}`), cherches) ? 1 : 0
  }
  return entrees
    .filter((entree) => correspond(entree.mots.split(' '), cherches))
    .map((entree) => ({ entree, n: score(entree) }))
    .sort((a, b) => b.n - a.n || a.entree.titre.localeCompare(b.entree.titre, 'fr') || (a.entree.page ?? '').localeCompare(b.entree.page ?? '', 'fr', { numeric: true }))
    .map(({ entree }) => entree)
}

/** Page A à Z : la base répond à la recherche, à la lettre et aux choix, sauf celui qu'on recompte (`sauf`) */
export function baseVisible(base: EntreeBase, filtres: FiltresBases, lettre = '', sauf?: (typeof CHOIX)[number]) {
  return correspond(base.mots, motsDe(filtres.q)) && (!lettre || base.groupe === `lettre-${lettre}`) && CHOIX.every((c) => c === sauf || !filtres[c] || base[c].includes(filtres[c]))
}

/** Résultats d'une recherche : titre qui commence par la recherche, puis tous les mots dans le titre, puis le reste ; l'ordre alphabétique départage */
export function trierResultats<T extends EntreeBase>(bases: T[], q: string) {
  const cherches = motsDe(q)
  const debut = cherches.join(' ')
  const score = (base: T) => (base.titre.join(' ').startsWith(debut) ? 2 : correspond(base.titre, cherches) ? 1 : 0)
  return bases.map((base) => ({ base, n: score(base) })).sort((a, b) => b.n - a.n).map(({ base }) => base)
}

/** Nombre de bases par valeur de chaque menu, compte tenu des autres filtres : un menu ne se limite pas lui-même */
export function compterChoix(bases: EntreeBase[], filtres: FiltresBases, lettre = '') {
  const comptes = { s: new Map<string, number>(), t: new Map<string, number>(), v: new Map<string, number>() }
  for (const c of CHOIX) {
    for (const base of bases) {
      if (baseVisible(base, filtres, lettre, c)) for (const id of base[c]) comptes[c].set(id, (comptes[c].get(id) ?? 0) + 1)
    }
  }
  return comptes
}

const SOFIA ='https://umontreal.on.worldcat.org/search?clusterResults=true&baseScope=wz:11098&lang=fr&stickyFacetsChecked=on&changedFacet=database&database=Xwc&overrideStickyFacetDefault=true'

/** Résultats Sofia pour une requête, avec le préfixe « kw: », comme dans bibweb (lib/sofia.ts) */
export const urlSofia = (requete: string) => `${SOFIA}&queryString=kw:${encodeURIComponent(requete)}`
