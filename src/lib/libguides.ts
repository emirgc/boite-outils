/*
 * Lecture des guides au build : le jeton et le secret ne quittent jamais le
 * serveur de build, les pages publiées sont statiques.
 *
 * L'API donne la structure (pages, boîtes avec `expand=pages.boxes`) et le
 * contenu (assets), mais rien ne relie un asset à sa boîte : `map_id` et
 * `count_mapped` ne mènent à aucune route. Seule la page publique connaît ce
 * lien, l'ordre des contenus, les titres affichés et les onglets.
 */
import { createHash } from 'node:crypto'
import * as cheerio from 'cheerio'
import personnel from '@/data/personnel.json'
import { jourMontreal, lirePagesAvecFil } from './fils'
import { marquerLiensExternes } from './liens-externes'
import { adressesDe, carrouselDepuis, cheminsDes, equipeDepuis, htmlRessource, listeFil, listeWidget, menuWidget, nettoyerContenu, nettoyerGuide, slugifier, type SectionBrute } from './nettoyage'

const API = 'https://lgapi-ca.libapps.com/1.2'
const SITE = 'https://boite-outils.bib.umontreal.ca'

/** « La boîte à outils » : la page d'accueil du site est un guide */
export const ID_ACCUEIL = 739631
/** Ressources par discipline */
const ID_DISCIPLINES = 739713
/** Ressources par discipline, Trouver et évaluer, Citer ses sources, Faire de la recherche */
export const PORTAILS_PRINCIPAUX = [ID_DISCIPLINES, 743330, 741593, 744202]
/** Les 12 portails disciplinaires, listés dans « Ressources par discipline » */
export const PORTAILS_DISCIPLINES = [749346, 743572, 743573, 743820, 743821, 743848, 743892, 743894, 743911, 743913, 743920, 743925]
export const PORTAILS = [...PORTAILS_PRINCIPAUX, ...PORTAILS_DISCIPLINES]

const TYPE_INTERNE = 5
const REPERTOIRE = 'https://bib.umontreal.ca/nous-joindre/notre-equipe/'
const APPELS_SIMULTANES = 6

interface PageApi {
  id: number | string
  name: string
  position: number | string
  enable_display: number | string
  parent_id?: number | string
}

interface GuideApi {
  id: number
  name: string
  description: string
  updated: string
  friendly_url: string | null
  type_id: number
  owner?: { first_name: string; last_name: string }
  pages?: PageApi[]
}

interface AssetApi {
  id: number
  type_id: number
  name?: string
  description: string
  url?: string
  meta?: { num_items?: number }
}

/** Seuls les champs publiés sont déclarés : la réponse contient aussi des notes internes (internal_note) */
interface BaseApi {
  id: number | string
  name: string
  description?: string
  url: string
  friendly_url?: string
  enable_hidden: number | string
  site_id: number | string
  enable_new: number | string
  new_expiration?: string
  enable_trial: number | string
  trial_expiration?: string
  alt_names?: string
  az_vendor_id?: number | string
  az_vendor_name?: string
  az_types?: { id: number | string; name: string }[]
  subjects?: { id: number | string; name: string; featured?: number | string }[]
  icons?: { id: number | string; file: string; description: string; url?: string }[]
  meta?: { more_info?: string }
}

async function lire(reponse: Response, quoi: string) {
  if (!reponse.ok) throw new Error(`LibGuides : ${quoi} a répondu ${reponse.status}`)
  return reponse
}

// 256 guides et 1 650 pages : on ménage le site actuel et l'API
let actifs = 0
const enAttente: (() => void)[] = []

async function appelLimite(url: string | URL, options?: RequestInit) {
  if (actifs >= APPELS_SIMULTANES) await new Promise<void>((suite) => enAttente.push(suite))
  actifs++
  try {
    for (let essai = 1; ; essai++) {
      try {
        const reponse = await fetch(url, { ...options, signal: AbortSignal.timeout(60_000) })
        if ((reponse.status !== 429 && reponse.status < 500) || essai === 3) return reponse
      } catch (erreur) {
        if (essai === 3) throw erreur
      }
      await new Promise((suite) => setTimeout(suite, 2000 * essai))
    }
  } finally {
    actifs--
    enAttente.shift()?.()
  }
}

let jeton: Promise<string> | undefined

async function obtenirJeton() {
  const id = import.meta.env.LIBGUIDES_CLIENT_ID
  const secret = import.meta.env.LIBGUIDES_CLIENT_SECRET
  if (!id || !secret) throw new Error('LibGuides : LIBGUIDES_CLIENT_ID et LIBGUIDES_CLIENT_SECRET manquent (voir .env.example)')
  const corps = new URLSearchParams({ client_id: id, client_secret: secret, grant_type: 'client_credentials' })
  const reponse = await lire(await fetch(`${API}/oauth/token`, { method: 'POST', body: corps }), 'le jeton')
  return (await reponse.json()).access_token as string
}

// Un seul jeton pour tout le build : les guides se chargent en parallèle
const demanderJeton = () => (jeton ??= obtenirJeton())

/** Un autre processus qui demande un jeton peut rendre le nôtre invalide : un 401 en redemande un, une fois */
async function api<T>(chemin: string): Promise<T> {
  const appeler = async (valeur: string) => appelLimite(`${API}/${chemin}`, { headers: { Authorization: `Bearer ${valeur}` } })
  const courant = demanderJeton()
  let reponse = await appeler(await courant)
  if (reponse.status === 401) {
    if (jeton === courant) jeton = undefined
    reponse = await appeler(await demanderJeton())
  }
  return (await (await lire(reponse, chemin)).json()) as T
}

// Par le nom, ou par la photo si le répertoire écrit le nom autrement (« Ginette-Denyse Melançon-Bolduc »)
const trouverPersonne = (nom: string) => personnel.find((p) => p.id === slugifier(nom) || p.photo?.replace(/\.[^.]+$/, '') === slugifier(nom))
const photoPersonne = (photo: string | null) => `/images/personnel/${photo ?? '_profile.webp'}`
const fichePersonne = (nomComplet: string) => `${REPERTOIRE}?q=${encodeURIComponent(nomComplet)}`

/** Vignette d'équipe : tout vient de bibweb si la personne y figure, sinon la photo et la fonction de LibGuides */
function vignettePersonne(nom: string, photo: string | undefined, fonction: string) {
  const personne = trouverPersonne(nom)
  if (!personne) return { nom, photo: photo?.replace(/^\/\//, 'https://'), detail: fonction }
  return { nom: personne.nomComplet, photo: photoPersonne(personne.photo), href: fichePersonne(personne.nomComplet), detail: personne.disciplines.join(', ') }
}

/** Fiche de LibGuides : titre et nom, avec la photo et le lien du répertoire de bibweb si la personne y figure */
function lireProfil($: cheerio.CheerioAPI, boite: ReturnType<cheerio.CheerioAPI>) {
  const fiche = boite.find('.s-lib-profile-container').first()
  const nom = fiche.find('.s-lib-profile-name').text().trim()
  const titre = boite.children('.s-lib-box-title').text().trim().replace(/^\.$/, '')
  const personne = trouverPersonne(nom)
  const imageSource = fiche.find('.s-lib-profile-image img').attr('src')
  const photo = personne ? photoPersonne(personne.photo) : imageSource?.replace(/^\/\//, 'https://')
  const courriels = fiche.find('a[href^="mailto:"]').toArray().map((a) => adressesDe($(a).attr('href')!))
  return { titre, nom, photo, href: personne && fichePersonne(personne.nomComplet), courriels }
}

/** Boîtes d'une page publique, dans l'ordre d'affichage, avec leurs assets */
async function boitesPubliques(idGuide: number, idPage: PageApi['id']) {
  const url = `${SITE}/c.php?g=${idGuide}&p=${idPage}`
  const $ = cheerio.load(await (await lire(await appelLimite(url), url)).text())
  type Contenu = { id: number; onglet?: { id: string; nom: string }; href?: string; icones: string; description?: string; html: string }
  const boites = new Map<string, { nom: string; ancre?: string; contenus: Contenu[] }>()
  const profils: ReturnType<typeof lireProfil>[] = []
  let courante: Contenu[] = []
  $('[id^="s-lg-box-"], [id^="s-lg-content-"]').each((_, el) => {
    const id = $(el).attr('id')!
    // Boîte numérotée, ou fiche du responsable du guide (profile_box_…)
    const boite = id.match(/^s-lg-box-(?!collapse-|wrapper-)(\w+)$/)
    const contenu = id.match(/^s-lg-content-(\d+)$/)
    // Le titre lu ici, pas dans l'API : une boîte flottante en a un dans l'API (« 4 carrés »), mais il ne s'affiche pas
    // Une fiche va sous le menu des guides, jamais dans le contenu
    if (boite && $(el).find('.s-lib-profile-container').length) {
      profils.push(lireProfil($, $(el)))
      courante = []
    } else if (boite) boites.set(boite[1], { nom: $(el).children('.s-lib-box-title').text().trim(), ancre: $(el).closest('[id^="s-lg-box-wrapper-"]').attr('id'), contenus: (courante = []) })
    // Contenu d'une boîte réutilisée : déjà rendu par le contenu qui l'englobe
    else if (contenu && !$(el).parents('[id^="s-lg-content-"]').length) {
      // L'API ignore aussi les onglets : leur nom et leur contenu viennent de la page publique
      // Le plus extérieur : une boîte réutilisée dans un onglet garde ses propres panneaux, sans nom
      const idOnglet = $(el).parents('[id^="s-lib-ctab-"]').last().attr('id')
      const onglet = idOnglet ? { id: idOnglet, nom: $(`a[href="#${idOnglet}"]`).first().text().trim() } : undefined
      const icones = $(el).find('img.s-lg-icon').toArray().map((img) => `<img class="icone-texte" src="${$(img).attr('src')}" alt="${$(img).attr('alt') ?? ''}">`).join('')
      // La description d'une base peut être personnalisée pour ce guide : seule la page publique l'affiche
      const description = $(el).find('.s-lg-database-desc').first().html()?.trim()
      courante.push({ id: Number(contenu[1]), onglet, href: $(el).find('a[href]').first().attr('href'), icones, description, html: $(el).html() ?? '' })
    }
  })
  // Carrousel et autres boîtes sans asset : seul leur rendu public existe
  for (const [id, boite] of boites) {
    if (boite.contenus.length) continue
    const public_ = $(`#s-lg-box-${id} .s-lib-box-content`).first().html() ?? ''
    boite.contenus.push({ id: Number(id) || 0, icones: '', html: public_.includes('s-lib-cpane-') ? carrouselDepuis(public_, boite.nom) : public_ })
  }
  return { boites, profils }
}

/** Remplace les widgets de liste de guides, chargés en JavaScript sur le site actuel, par leur contenu lu au build */
async function remplacerWidgets(html: string) {
  if (!html.includes('widgets.php')) return html
  const $ = cheerio.load(html, null, false)
  let traites = 0
  for (const script of $('script').toArray()) {
    const source = $(script).html()?.match(/js\.src\s*=\s*p\s*\+\s*"(:\/\/[^"]+widgets\.php\?[^"]+)"/)?.[1]
    if (!source) continue
    traites++
    const url = new URL(`https${source}`.replaceAll('&amp;', '&'))
    const js = await (await lire(await appelLimite(url), 'un widget')).text()
    $(`#s-lg-widget-${url.searchParams.get('config_id')}`).replaceWith(
      url.searchParams.get('list_format') === '1' ? listeWidget(js, `config_id ${url.searchParams.get('config_id')}`) : menuWidget(js, url.searchParams.get('drop_text') ?? 'Guides'),
    )
  }
  // Le nettoyage retire les scripts : un widget non reconnu disparaîtrait sans rien dire
  if (traites !== html.split('widgets.php').length - 1) throw new Error('LibGuides : widget de forme inconnue')
  return $.html()
}

const fils = new Map<string, Promise<string>>()

/** Un fil externe en panne ne doit pas bloquer le site : on signale et on renvoie vers lui */
function lireFil(asset: AssetApi) {
  const cle = `${asset.url}|${asset.meta?.num_items}`
  if (!fils.has(cle))
    fils.set(
      cle,
      appelLimite(asset.url!, { headers: { 'User-Agent': 'Mozilla/5.0' } })
        .then((reponse) => lire(reponse, `le fil ${asset.url}`))
        .then((reponse) => reponse.text())
        .then((xml) => listeFil(xml, asset.meta?.num_items || 5))
        .catch((erreur) => {
          console.warn(`[libguides] fil indisponible, contenu ${asset.id} : ${erreur}`)
          return htmlRessource({ ...asset, type_id: 2 }, asset.url)
        }),
    )
  return fils.get(cle)!
}

/** Pages affichées dans l'ordre du menu : chaque sous-page suit sa page parente */
function pagesAffichees(guide: GuideApi) {
  const position = (a: PageApi, b: PageApi) => Number(a.position) - Number(b.position)
  const visibles = (guide.pages ?? []).filter((p) => Number(p.enable_display) === 1).sort(position)
  const ids = new Set(visibles.map((p) => String(p.id)))
  const estSousPage = (p: PageApi) => ids.has(String(p.parent_id ?? 0))
  return visibles.filter((p) => !estSousPage(p)).flatMap((p) => [p, ...visibles.filter((s) => String(s.parent_id) === String(p.id))])
}

const racineDe = (guide: GuideApi) => (guide.id === ID_ACCUEIL ? '/' : guide.friendly_url ? `${new URL(guide.friendly_url).pathname.replace(/\/$/, '')}/` : `/g/${guide.id}/`)

let catalogue: Promise<ReturnType<typeof construireCatalogue>> | undefined

function construireCatalogue(guides: GuideApi[]) {
  const publies = guides.filter((g) => g.type_id !== TYPE_INTERNE)
  const pagesLocales = new Map<string, string>()
  const racines = new Map<string, string>([['', '/']])
  const parRacine = new Map<string, GuideApi>()
  const routes: { idGuide: number; idPage: string; chemin: string; cacheKey: string }[] = []
  // Liens et fil d'Ariane d'une page dépendent des autres guides : un guide renommé ou déplacé invalide tout
  const plan = publies.map((g) => [g.id, g.name, racineDe(g), pagesAffichees(g).map((p) => [p.id, p.name])]).sort((a, b) => Number(a[0]) - Number(b[0]))
  // Le middleware échappe à l'empreinte de code d'Astro : son résultat sur un exemple entre dans la clé.
  // SITE_ENV aussi : passer en production doit retirer le noindex des pages en cache.
  const empreinte = createHash('sha256').update(JSON.stringify(plan) + marquerLiensExternes('<a href="https://x"><img alt="i"></a><a href="https://x">t</a>') + process.env.SITE_ENV).digest('hex')
  // Fils RSS et widgets changent sans toucher à la date du guide. Une page avec un fil est relue chaque jour, à la
  // date de Montréal ; les autres chaque semaine, pour leurs widgets : tout relire ferait 1 950 requêtes par jour
  const semaine = Math.floor(Date.now() / (7 * 24 * 3600 * 1000))
  const jour = jourMontreal()
  const avecFil = lirePagesAvecFil()
  for (const g of publies) {
    const racine = racineDe(g)
    parRacine.set(racine, g)
    racines.set(`g:${g.id}`, racine)
    if (g.friendly_url) racines.set(new URL(g.friendly_url).pathname.replace(/\/$/, ''), racine)
    const pages = pagesAffichees(g).map((p) => ({ id: String(p.id), nom: p.name.trim() }))
    for (const [id, chemin] of cheminsDes(pages, racine)) {
      pagesLocales.set(id, chemin)
      routes.push({ idGuide: g.id, idPage: id, chemin, cacheKey: `${g.updated}|${empreinte}|${avecFil.has(chemin) ? jour : semaine}` })
    }
  }
  return { guides: publies, pagesLocales, racines, parRacine, routes }
}

/** Tous les guides publiés : une seule requête, qui suffit à connaître toutes les adresses du site */
function lireCatalogue() {
  catalogue ??= api<GuideApi[]>('guides?status=1&expand=pages,owner').then(construireCatalogue)
  return catalogue
}

/** Routes des pages de guide, sans les portails ni l'accueil, qui ont leur propre gabarit */
export async function routesGuides() {
  const { routes } = await lireCatalogue()
  return routes.filter((r) => r.idGuide !== ID_ACCUEIL && !PORTAILS.includes(r.idGuide))
}

/** Maillons du fil d'Ariane au-dessus d'un guide : portail des disciplines, puis guide parent selon son adresse */
export async function ancetres(idGuide: number) {
  const { guides, parRacine } = await lireCatalogue()
  const g = guides.find((x) => x.id === idGuide)!
  const maillons: { libelle: string; href: string }[] = []
  const segments = racineDe(g).split('/').filter(Boolean)
  for (let i = 1; i < segments.length; i++) {
    const racine = `/${segments.slice(0, i).join('/')}/`
    const parent = parRacine.get(racine)
    if (parent) maillons.push({ libelle: parent.name.trim(), href: racine })
  }
  const portail = PORTAILS_DISCIPLINES.find((id) => id === idGuide || maillons.some((m) => m.href === racineDe(guides.find((x) => x.id === id)!)))
  if (portail) maillons.unshift({ libelle: guides.find((x) => x.id === ID_DISCIPLINES)!.name.trim(), href: racineDe(guides.find((x) => x.id === ID_DISCIPLINES)!) })
  return maillons
}

async function chargerGuide(idGuide: number) {
  const accueil = idGuide === ID_ACCUEIL
  const { guides: tous, pagesLocales, racines } = await lireCatalogue()
  const guide = tous.find((g) => g.id === idGuide)
  if (!guide) throw new Error(`LibGuides : guide ${idGuide} absent des guides publiés`)
  const assets = await api<AssetApi[]>(`assets?guide_ids=${idGuide}`)
  const assetsParId = new Map(assets.map((a) => [a.id, a]))
  const pages = pagesAffichees(guide)
  const ids = new Set(pages.map((p) => String(p.id)))

  const sections: SectionBrute[] = await Promise.all(
    pages.map(async (page) => {
      const { boites: publiques, profils } = await boitesPubliques(idGuide, page.id)
      return {
        id: String(page.id),
        nom: page.name.trim(),
        parent: ids.has(String(page.parent_id ?? 0)) ? String(page.parent_id) : undefined,
        profils,
        boites: await Promise.all([...publiques].map(async ([id, { nom, ancre, contenus }]) => ({
          id,
          nom,
          ancre,
          contenus: await Promise.all(contenus.map(async ({ id: idAsset, onglet, href, icones, description, html }) => {
            const asset = assetsParId.get(idAsset)
            if (asset?.type_id === 1) return { id: idAsset, html: equipeDepuis(await remplacerWidgets(asset.description), vignettePersonne), onglet }
            if (asset?.type_id === 3 && asset.url) return { id: idAsset, html: await lireFil(asset), onglet }
            if (asset && [2, 4, 5, 9, 10].includes(asset.type_id)) return { id: idAsset, html: htmlRessource({ ...asset, description: description ?? asset.description }, href, icones), onglet }
            // Asset réutilisé d'un autre guide ou type inconnu : le rendu public plutôt qu'un trou
            return { id: idAsset, html, onglet }
          })),
        }))),
      }
    }),
  )

  return {
    nom: guide.name.trim(),
    description: (guide.description ?? '').trim(),
    misAJour: guide.updated,
    racine: racineDe(guide),
    // Le nom seulement : l'API donne aussi le courriel, qui n'a pas à être publié
    auteur: guide.owner && `${guide.owner.first_name} ${guide.owner.last_name}`.trim(),
    sections: nettoyerGuide(sections, {
      idGuide,
      urlGuide: guide.friendly_url || `${SITE}/c.php?g=${idGuide}`,
      chemins: cheminsDes(sections, racineDe(guide)),
      titresIntacts: accueil,
      portail: PORTAILS.includes(idGuide),
      pagesLocales,
      racines,
    }),
  }
}

export type Guide = Awaited<ReturnType<typeof chargerGuide>>

// En dev, Astro réexécute la page à chaque requête : une seule lecture par lancement
const guides = new Map<number, Promise<Guide>>()

export function guide(id: number) {
  if (!guides.has(id)) guides.set(id, chargerGuide(id))
  return guides.get(id)!
}

let bases: ReturnType<typeof lireBases> | undefined

async function lireBases() {
  const { racines, pagesLocales } = await lireCatalogue()
  // Sans az_props, l'API ne donne ni enable_new ni enable_trial
  const liste = await api<BaseApi[]>('az?expand=az_types,az_props,subjects,friendly_url,icons')
  const aujourdhui = new Date().toISOString()
  // Une date nulle (0000-00-00) : pas d'échéance
  const enCours = (active: number | string, fin?: string) => Number(active) === 1 && (!fin || fin.startsWith('0000') || fin.replace(' ', 'T') > aujourdhui)
  // Le texte vient de l'éditeur de LibGuides : même nettoyage que les guides
  const propre = (html: string | undefined, id: BaseApi['id']) => nettoyerContenu(html ?? '', Number(id), '', { idGuide: 0, urlGuide: SITE, chemins: new Map(), titresIntacts: true, racines, pagesLocales }, new Map())
  const entrees = (valeurs: { id: number | string; name: string }[] = []) => valeurs.map(({ id, name }) => ({ id: String(id), nom: name.trim() }))
  return liste
    .filter((b) => Number(b.enable_hidden) !== 1)
    .map((b) => {
      const nom = propre(b.name.trim(), b.id)
      return {
        id: String(b.id),
        nom,
        texte: cheerio.load(nom, null, false).root().text(),
        // L'adresse courte de LibGuides passe par le proxy de l'UdeM au besoin, pas `url`
        href: b.friendly_url || b.url,
        description: propre(b.description, b.id),
        plus: propre(b.meta?.more_info, b.id),
        autresNoms: b.alt_names?.trim() ?? '',
        fournisseur: b.az_vendor_id && b.az_vendor_name ? { id: String(b.az_vendor_id), nom: b.az_vendor_name.trim() } : undefined,
        types: entrees(b.az_types),
        sujets: entrees(b.subjects),
        // Base mise en avant pour un sujet : « id:rang », 0 voulant dire non
        vedettes: (b.subjects ?? []).filter((s) => Number(s.featured) > 0).map((s) => `${s.id}:${Number(s.featured)}`),
        acces: (b.icons ?? []).map((i) => ({
          libelle: i.description.replace(/\s*\(proxy\)$/, ''),
          href: i.url || undefined,
          icone: `https://d1qywhc7l90rsa.cloudfront.net/sites/${b.site_id}/icons/${i.id}/${i.file}`,
        })),
        nouveau: enCours(b.enable_new, b.new_expiration),
        essai: enCours(b.enable_trial, b.trial_expiration),
      }
    })
    .sort((a, b) => a.texte.localeCompare(b.texte, 'fr', { sensitivity: 'base' }))
}

/** Liste A à Z, sans les bases masquées */
export function basesDeDonnees() {
  bases ??= lireBases()
  return bases
}

/** Guides publiés, sans l'accueil, et bases de données : ce que la recherche peut suggérer */
export async function listeRecherche() {
  const [{ guides: tous }, listeBases] = await Promise.all([lireCatalogue(), basesDeDonnees()])
  return [
    ...tous.filter((g) => g.id !== ID_ACCUEIL).map((g) => ({ nom: g.name.trim(), url: racineDe(g) })),
    ...listeBases.map((b) => ({ nom: b.texte, url: b.href, base: true, ...(b.autresNoms && { autres: b.autresNoms }) })),
  ]
}
