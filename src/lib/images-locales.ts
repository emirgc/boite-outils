/*
 * Images des guides servies par le site lui-même plutôt que par le site des
 * bibliothèques ou par LibGuides : une icône Phosphor si le nom y correspond,
 * sinon la copie de public/images/bib. Une image inconnue garde son adresse.
 */
import { existsSync, readFileSync } from 'node:fs'

// Les couleurs des fichiers de la source. Une <img> n'hérite pas de currentColor : elles restent dans le SVG
const BLEU = '#0057ac'
const ORANGE = '#f04e24'
const BIB = /^https?:\/\/www\.bib\.umontreal\.ca(\/[^?#]+)$/
const ICONE_BIB = /^\/images\/libguides\/(bleu\/)?([a-z0-9-]+)\.svg$/
const ICONE_LIBGUIDES = /^https?:\/\/d1qywhc7l90rsa\.cloudfront\.net\/sites\/\d+\/icons\/\d+\/([\w-]+\.png)$/

function iconePhosphor(nom: string, couleur: string) {
  const fichier = `node_modules/@phosphor-icons/core/assets/regular/${nom}.svg`
  if (!existsSync(fichier)) return undefined
  const svg = readFileSync(fichier, 'utf8').replace('fill="currentColor"', `fill="${couleur}" width="32" height="32"`)
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** Icône écrite pour la police Phosphor de la source (<i class="ph ph-gavel">) : cette police n'est pas chargée ici */
export function iconeDePolice(classes: string, bleu: boolean) {
  const nom = classes.match(/(?:^|\s)ph-([a-z0-9-]+)/)?.[1]
  return nom && iconePhosphor(nom, bleu ? BLEU : ORANGE)
}

// Les icônes d'accès de LibGuides : leur nom ne dit pas lequel prendre chez Phosphor
const iconeLibguides = (fichier: string) => {
  if (fichier === 'logo-udem.png') return '/images/bib/logo-udem.png'
  if (fichier === 'mdp.png') return iconePhosphor('password', BLEU)
  if (fichier === 'cederom.png') return iconePhosphor('disc', BLEU)
}

export function imageLocale(src: string) {
  const adresse = src.replace(/^\/\//, 'https://')
  const libguides = adresse.match(ICONE_LIBGUIDES)
  if (libguides) return iconeLibguides(libguides[1]) ?? src
  const chemin = adresse.match(BIB)?.[1]
  if (!chemin) return src
  // La copie d'abord : deux fichiers portent le nom d'une icône Phosphor, avec un autre dessin
  if (existsSync(`public/images/bib${chemin}`)) return `/images/bib${chemin}`
  const icone = chemin.match(ICONE_BIB)
  return (icone && iconePhosphor(icone[2], icone[1] ? BLEU : ORANGE)) ?? src
}
