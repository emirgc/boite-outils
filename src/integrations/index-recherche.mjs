/*
 * Index de la page de résultats, tiré du HTML produit : lire le contenu au build
 * interrogerait LibGuides pour chaque guide et annulerait le build incrémental.
 * Les pages reprises du cache sont dans dist/ comme les autres.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'
import { BLOCS, espaces, extrait as couper, TITRES } from '../lib/extrait.ts'
import { motsDe } from '../lib/recherche-guides.ts'

const CHEMIN_BASES = '/bases-de-donnees/'
const LONGUEUR_EXTRAIT = 180

const extrait = (texte) => couper(texte, LONGUEUR_EXTRAIT)
// Chaque mot une seule fois : l'ordre ne sert pas, seul le titre compte au classement
const motsDistincts = (texte) => [...new Set(motsDe(texte))].join(' ')

/** Les bases de la page A à Z : seul ce qui porte data-cherche est du contenu */
function entreesBases($) {
  return $('[data-base]').toArray().map((el) => {
    const base = $(el)
    const lien = base.find('.base-nom').first()
    base.find('.visuellement-masque').remove()
    return {
      titre: espaces(lien.text()),
      url: lien.attr('href'),
      extrait: extrait(base.find('.ressource-description').first().text()),
      mots: motsDistincts(base.find('[data-cherche]').toArray().map((c) => $(c).text()).join(' ')),
      base: true,
    }
  })
}

/** Page de guide : le titre de l'onglet donne « page | guide | … » ; un portail ou l'accueil, « guide | … » */
function entreePage($, chemin) {
  const [premier, second] = $('title').text().split(' | ').map(espaces)
  const guide = espaces($('h1').first().text()) || premier
  const page = second === guide && premier !== guide ? premier : undefined
  $('script, style, nav, form, .visuellement-masque').remove()
  const racine = $('.guide-contenu').length ? $('.guide-contenu') : $('main')
  const contenu = racine.text()
  // L'extrait saute les titres, qui répètent souvent le nom de la page
  racine.find(TITRES).remove()
  return { titre: guide, ...(page && { page }), url: chemin, extrait: extrait(racine.text()), mots: motsDistincts(`${guide} ${page ?? ''} ${contenu}`) }
}

export function entreesDe(html, chemin) {
  if (chemin === '/resultats/') return []
  const $ = cheerio.load(html)
  // text() colle les blocs voisins : « citoyens</h2><p>Suggestions » ferait un seul mot
  $(BLOCS).after(' ')
  return chemin === CHEMIN_BASES ? entreesBases($) : [entreePage($, chemin)]
}

export default function indexRecherche() {
  return {
    name: 'index-recherche',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const racine = fileURLToPath(dir)
        const entrees = readdirSync(racine, { recursive: true })
          .map(String)
          .filter((f) => f.endsWith('index.html'))
          .sort()
          .flatMap((f) => entreesDe(readFileSync(join(racine, f), 'utf8'), `/${f.replace(/index\.html$/, '')}`))
        writeFileSync(join(racine, 'index-recherche.json'), JSON.stringify(entrees))
        logger.info(`${entrees.length} entrées`)
      },
    },
  }
}
