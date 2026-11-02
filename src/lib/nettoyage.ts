/*
 * Passe le HTML de l'éditeur de LibGuides aux principes de bibweb : aucun
 * style en ligne, des <details> natifs pour les accordéons et une seule
 * hiérarchie de titres. Le contenu et les images de la source restent tels quels.
 */
import * as cheerio from 'cheerio'
import { iconeDePolice, imageLocale } from './images-locales.ts'

export interface SectionBrute {
  id: string
  nom: string
  /** Page parente, pour une sous-page */
  parent?: string
  /** Fiches de la page, affichées sous le menu des guides */
  profils?: { titre: string; nom: string; photo?: string; href?: string; courriels?: string[][] }[]
  boites: { id: string; nom: string; ancre?: string; contenus: { id: number; html: string; onglet?: { id: string; nom: string } }[] }[]
}

interface Contexte {
  idGuide: number
  urlGuide: string
  /** Chemin publié de chaque page du guide, par id de page */
  chemins: Map<string, string>
  /** Accueil : ses titres sont déjà ceux de la page, on ne les décale pas */
  titresIntacts?: boolean
  /** Niveau du titre de la boîte : 2 si elle n'en affiche pas, le contenu suit alors celui de la page */
  niveauBoite?: number
  /** Titre de la boîte, pour nommer une iframe qui n'a pas de titre */
  titreBoite?: string
  /** Portail : le titre de ses boîtes est un h2, juste sous le h1 de la page */
  portail?: boolean
  /** Chemins de toutes les pages du site, par id de page, pour les liens ?p= venus d'un autre guide */
  pagesLocales?: Map<string, string>
  /** Racine publiée de chaque guide, par chemin LibGuides (sans / final) et par « g:id » */
  racines?: Map<string, string>
}

const BALISES_PERMISES = new Set(
  'p a ul ol li h2 h3 h4 h5 h6 strong em b i small sub sup br hr img table thead tbody tfoot tr th td caption details summary div blockquote cite code figure figcaption iframe script pre abbr q u ins'.split(' '),
)
// Retirées avec leur contenu ; les autres balises inconnues (span, font, big…) gardent leur texte
const BALISES_RETIREES = 'style, object, embed, form, input, link, meta, svg, .sr-only'
const ATTRIBUTS_PERMIS: Record<string, string[]> = {
  a: ['href'],
  ul: ['tabindex'],
  img: ['src', 'alt', 'width', 'height', 'loading'],
  td: ['colspan', 'rowspan'],
  th: ['colspan', 'rowspan', 'scope'],
  details: ['id'],
  div: ['tabindex', 'role', 'aria-label', 'aria-roledescription', 'id'],
  iframe: ['src', 'title', 'width', 'height', 'allow', 'allowfullscreen', 'loading'],
  script: ['src', 'type'],
}
// Classes de l'éditeur que guide.css reprend, plus celles posées ici
const CLASSES_PERMISES = new Set([
  ...'tuile-wrapper frame-light icone-discipline texte sift-grid sift-card sift-title sift-text sift-img sift-links accessible-toggle toggle-button volet sommaire titre volet-contenu alerte encadre chapeau icone-texte tableau flottante flottante-droite retrait centre titre-accueil indispensables frame text-wrapper quatres tuile-photo text-wrapper-photo photo-wrapper photo contenutuile bouton-texte row conteneur-question-image question-list question question-image sift-link icon-line equipe vignette vignette-photo vignette-nom vignette-detail titre-vide menu-deroulant fil-nouvelles fil-date frame-bleu quatre-tuiles-bleues name-wrapper carrousel carrousel-piste liste-ressources ressource-plus livre couverture ressource-description ressource-type indent texte-petit liste-compacte table-alterne-bleu caption-top moins titre-produire titre-diffuser titre-bibliometrie titre-gdr titre-droit-auteur image-agrandie tiles tiles-label'.split(' '),
  ...Array.from({ length: 12 }, (_, i) => `col-md-${i + 1}`),
])

// Sources de vidéos et d'exercices déjà intégrées aux guides ; une autre source devient un simple lien
const IFRAMES_PERMIS = /(^|\.)(panopto\.com|youtube\.com|youtube-nocookie\.com|bib\.umontreal\.ca|h5p\.com|fabriquerel\.org|reseau-canope\.fr|canal-u\.tv|univ-nantes\.fr|google\.com|genially\.com|genial\.ly|libapps\.com|libcal\.com|vimeo\.com)$/
// Quiz et arbres de décision LibWizard : le seul script conservé, il remplit le <div id="form_…"> voisin
const SCRIPT_PERMIS = 'script[src*="umontreal.libwizard.com/form_loader"]'
// Le français est la langue de la page ; « X-NONE » et les autres valeurs de Word ne désignent pas une langue
const LANGUE_ETRANGERE = /^(?!fr\b)[a-z]{2,3}(-[a-z0-9]+)*$/i

const ID_LOCAL = (idAsset: number, id: string) => `a${idAsset}-${id}`

export function reecrireLien(href: string, ctx: Contexte, ancres: Map<string, string>, idAsset: number, idPage: string) {
  const brut = href.trim()
  if (brut === '#') return null
  if (/^#s-(lg-box|lib-ctab)-/.test(brut)) return brut
  if (brut.startsWith('#')) return `#${ancres.get(`${idPage}${brut}`) ?? ID_LOCAL(idAsset, brut.slice(1))}`
  let url: URL
  try {
    url = new URL(brut, ctx.urlGuide)
  } catch {
    return null
  }
  if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) return null

  const racine = new URL(ctx.urlGuide)
  // Liste A à Z : notre page comprend les mêmes filtres que celle de LibGuides
  if (url.hostname === racine.hostname && url.pathname === '/az.php') {
    const filtres = new URLSearchParams([...url.searchParams].filter(([nom]) => ['q', 's', 't', 'v', 'a'].includes(nom))).toString()
    return `/bases-de-donnees/${filtres && `?${filtres}`}`
  }
  const dansGuide =
    url.hostname === racine.hostname &&
    (url.pathname.replace(/\/$/, '') === racine.pathname.replace(/\/$/, '') || (url.pathname === '/c.php' && url.searchParams.get('g') === String(ctx.idGuide)))
  if (!dansGuide) {
    if (url.hostname !== racine.hostname) return url.href
    // Une ancre d'accordéon dépend de l'asset de l'autre guide : seules celles de boîte et d'onglet s'y retrouvent
    const ancreStable = /^#s-(lg-box|lib-ctab)-/.test(url.hash) ? url.hash : ''
    const idPageVisee = url.searchParams.get('p')
    if (idPageVisee) {
      const pageLocale = ctx.pagesLocales?.get(idPageVisee)
      return pageLocale ? `${pageLocale}${ancreStable}` : url.href
    }
    const racineLocale = ctx.racines?.get(url.pathname.replace(/\/$/, '')) ?? ctx.racines?.get(`g:${url.searchParams.get('g')}`)
    return racineLocale ? `${racineLocale}${ancreStable}` : url.href
  }

  const page = url.searchParams.get('p') ?? idPage
  const chemin = ctx.chemins.get(page)
  // Page absente du site (masquée dans LibGuides) : on garde le lien d'origine
  if (!chemin) return url.href
  const prefixe = page === idPage ? '' : chemin
  const fragment = url.hash.slice(1)
  if (/^s-(lg-box|lib-ctab)-/.test(fragment)) return `${prefixe}#${fragment}`
  const ancre = ancres.get(`${page}#${fragment}`)
  if (ancre) return `${prefixe}#${ancre}`
  // Sans ?p= ni ancre connue, l'adresse du guide mène à sa première page
  return url.searchParams.has('p') ? chemin : [...ctx.chemins.values()][0]
}

// Accordéon jQuery UI : son script nomme un conteneur dont les enfants alternent titre et contenu
function convertirAccordeonsJquery($: cheerio.CheerioAPI) {
  $('script').each((_, script) => {
    for (const [, id] of ($(script).html() ?? '').matchAll(/\$\(\s*["']#([\w-]+)["']\s*\)\s*\.accordion\(/g)) {
      $(`[id="${id}"]`).children('h1, h2, h3, h4, h5, h6').each((_, el) => {
        const titre = $(el)
        const contenu = titre.next('div')
        titre.replaceWith(`<div class="accordion-item"><h3><button class="titre-accordion">${titre.html()}</button></h3><div class="accordion-content">${contenu.html() ?? ''}</div></div>`)
        contenu.remove()
      })
    }
  })
}

// Bouton qui affiche un exemple JSON gardé dans un script : un <details> rempli au build, sans script
function convertirReponsesJson($: cheerio.CheerioAPI) {
  $('script').each((_, script) => {
    const source = $(script).html() ?? ''
    const [, varBloc, varDonnees] = source.match(/(\w+)\s*\.textContent\s*=\s*JSON\.stringify\(\s*(\w+)/) ?? []
    const varBouton = source.match(/(\w+)\s*\.addEventListener\(\s*['"]click/)?.[1]
    if (!varBloc || !varDonnees || !varBouton) return
    const element = (nom: string) => $(`[id="${source.match(new RegExp(`${nom}\\s*=\\s*document\\.getElementById\\(['"]([\\w-]+)['"]\\)`))?.[1]}"]`)
    const [bloc, bouton] = [element(varBloc), element(varBouton)]
    const json = source.match(new RegExp(`${varDonnees}\\s*=\\s*(\\{[\\s\\S]*?\\n\\s*\\})\\s*;`))?.[1]
    if (!bloc.length || !bouton.length || !json) return
    let donnees: unknown
    try {
      donnees = JSON.parse(json)
    } catch (erreur) {
      return void console.warn(`[nettoyage] exemple JSON illisible, ${varDonnees} : ${erreur}`)
    }
    const details = $('<details class="ressource-plus"><summary></summary><pre></pre></details>')
    details.find('summary').text(bouton.text().trim())
    details.find('pre').text(JSON.stringify(donnees, null, 2))
    bloc.remove()
    ;(bouton.parent('p').length ? bouton.parent() : bouton).replaceWith(details)
  })
}

// La visionneuse de la source, ouverte par :target, perd son CSS : la vignette mène à l'image, qui ne reste pas dans la page
function convertirVisionneuses($: cheerio.CheerioAPI) {
  $('.lb[id]').each((_, el) => {
    const image = $(el).find('img').attr('src')
    const lien = $(`a[href="#${$(el).attr('id')}"]`)
    if (!image || !lien.length) return
    lien.attr('href', image).addClass('image-agrandie')
    $(el).remove()
  })
  $('a[href]')
    .filter((_, el) => !$(el).text().trim() && $(el).find('img').length > 0 && (/\.(png|jpe?g|gif|webp)([?#]|$)/i.test($(el).attr('href')!)))
    .addClass('image-agrandie')
}

function poserIframes($: cheerio.CheerioAPI, titreBoite?: string) {
  $('iframe').each((_, el) => {
    const iframe = $(el)
    const src = (iframe.attr('src') ?? '').trim().replace(/^\/\//, 'https://')
    let hote = ''
    try {
      hote = new URL(src).hostname
    } catch {
      return void iframe.remove()
    }
    const titre = iframe.attr('title')?.trim()
    if (!IFRAMES_PERMIS.test(hote)) return void iframe.replaceWith(`<a href="${echapper(src)}">${echapper(titre || src)}</a>`)
    iframe.attr('src', src).attr('title', titre || (titreBoite ? `Contenu intégré : ${titreBoite}` : 'Contenu intégré')).attr('loading', 'lazy')
  })
}

function largeurEnPx(style = '') {
  const m = style.match(/(?:^|;|\s)width:\s*(\d*\.?\d+)(px|r?em)/)
  // Sans sa largeur, un SVG occupe toute la colonne. Le style disparaît : em se calcule sur le texte courant, 16 px
  return m ? Math.round(Number(m[1]) * (m[2] === 'px' ? 1 : 16)) : undefined
}

function aplatirAccordeons($: cheerio.CheerioAPI) {
  // La source ferme mal certains volets : le suivant se retrouve dans le précédent
  $('.accordion-item')
    .toArray()
    .reverse()
    .forEach((el) => {
      const item = $(el)
      item.children('.accordion-custom, .accordion-item').insertAfter(item)
    })

  $('.accordion-item')
    .toArray()
    .reverse()
    .forEach((el) => {
      const item = $(el)
      const bouton = item.find('.titre-accordion').first()
      if (!bouton.length) return void item.replaceWith(item.contents())
      const id = bouton.attr('id')
      const profondeur = item.parents('.accordion-item, .volet').length
      const titre = bouton.html() ?? ''
      bouton.closest('h2, h3, h4, h5, h6').remove()
      bouton.remove()
      item.children('.accordion-content').each((_, c) => void $(c).replaceWith($(c).contents()))
      const niveau = Math.min(4 + profondeur, 6)
      const volet = $(
        `<details class="volet"><summary class="sommaire"><h${niveau} class="titre">${titre}</h${niveau}></summary><div class="volet-contenu"></div></details>`,
      )
      if (id) volet.attr('id', id)
      volet.find('.volet-contenu').append(item.contents())
      item.replaceWith(volet)
    })
  $('.accordion-custom').each((_, el) => void $(el).replaceWith($(el).contents()))
}

function poserAlertes($: cheerio.CheerioAPI) {
  $('div[style*="background:#eeeeee"]').each((_, el) => {
    const bloc = $(el)
    const precedent = bloc.prev('.alerte, .encadre')
    // Un exemple ou une annonce reste à part et n'avertit pas, même s'il contient un ⚠️ dans son texte
    const aPart = (texte: string) => /^\s*(⚙|🌟|exemple)/iu.test(texte)
    const distinct = aPart(bloc.text())
    // Un même encadré gris sert aux avertissements (⚠️) et aux exemples
    const avertit = !distinct && bloc.text().includes('⚠')
    const contenu = bloc.children('p, ul, ol').length ? bloc.contents() : $('<p></p>').append(bloc.contents())
    if (precedent.length && !distinct && !aPart(precedent.text())) {
      precedent.append(contenu)
      if (avertit) precedent.attr('class', 'alerte')
      bloc.remove()
    } else {
      const alerte = $(`<div class="${avertit ? 'alerte' : 'encadre'}"></div>`).append(contenu)
      if (bloc.hasClass('retrait')) alerte.addClass('retrait')
      bloc.replaceWith(alerte)
    }
  })
  // L'icône d'avertissement est portée par le gabarit de l'encadré
  $('.alerte, .encadre, h3, h4, p')
    .contents()
    .filter((_, n) => n.type === 'text')
    .each((_, n) => {
      if ('data' in n) n.data = n.data.replace(/⚠️\s*/gu, '')
    })
  // Fond et marge interne : la source détache ce bloc du texte, quelle qu'en soit la couleur. Le blanc ne se distingue pas de la page
  $('div[style*="background"][style*="padding"]')
    .filter((_, el) => {
      const bloc = $(el)
      const fond = bloc.attr('style')!.match(/background(?:-color|-image)?:\s*([^;]+)/i)?.[1]?.trim().toLowerCase() ?? ''
      const classes = (bloc.attr('class') ?? '').split(/\s+/).filter((c) => CLASSES_PERMISES.has(c) && !c.startsWith('flottante'))
      return !/^(white|#fff(fff)?|transparent|none|rgb\(255,\s*255,\s*255\))/.test(fond) && !classes.length
    })
    .each((_, el) => {
      if (!$(el).parents('.encadre, .alerte').length) $(el).addClass('encadre')
    })
}

// La mise en page de la source passe par les styles en ligne : on garde ce qui compte en classes
function poserDisposition($: cheerio.CheerioAPI) {
  // Colonnes Bootstrap, quelle que soit la variante : celle qui s'applique sur grand écran devient col-md-N
  $('[class*="col-"]').each((_, el) => {
    const classes = ($(el).attr('class') ?? '').split(/\s+/)
    const largeur = (taille: string) => classes.map((c) => c.match(new RegExp(`^col${taille}-(\\d+)$`))?.[1]).find(Boolean)
    const n = largeur('-lg') ?? largeur('-md') ?? largeur('-sm') ?? largeur('-xs') ?? largeur('')
    if (n) $(el).attr('class', [...classes.filter((c) => !/^col(-\w+)?-\d+$/.test(c)), `col-md-${n}`].join(' '))
  })
  $('[style*="margin-left"]').each((_, el) => {
    const retrait = $(el).attr('style')?.match(/margin-left:\s*(\d+)px/)
    if (retrait && Number(retrait[1]) >= 100) $(el).addClass('retrait')
  })
  $('[style*="float"]').each((_, el) => {
    const sens = $(el).attr('style')?.match(/float:\s*(left|right)/)?.[1]
    if (sens) $(el).addClass(sens === 'left' ? 'flottante' : 'flottante-droite')
  })
  $('[class*="col-md-"] > :is(h2, h3):first-child').each((_, el) => {
    if (!$(el).text().trim()) $(el).replaceWith('<div class="titre-vide"></div>')
  })
  $('p[style*="text-align"]').each((_, el) => {
    if (/text-align:\s*center/.test($(el).attr('style')!)) $(el).addClass('centre')
  })
}

function poserImages($: cheerio.CheerioAPI) {
  $('i.ph').each((_, el) => {
    const icone = $(el)
    const src = iconeDePolice(icone.attr('class')!, icone.closest('.frame-bleu').length > 0)
    if (src) icone.replaceWith($('<img alt="">').attr('src', src).addClass(icone.attr('class')!))
  })
  $('img').each((_, el) => {
    const img = $(el)
    const largeur = largeurEnPx(img.attr('style'))
    if (img.is('.flottante') && el.next?.type === 'text') el.next.data = el.next.data.trimStart()
    if (largeur && largeur <= 64) img.addClass('icone-texte')
    else if (largeur) img.attr('width', String(largeur))
    // Du HTML collé par erreur dans le texte de remplacement serait lu tel quel
    img.attr('alt', (img.attr('alt') ?? '').replace(/<[^>]*>/g, '').trim())
    img.attr('loading', 'lazy')
    const src = img.attr('src')
    if (src) img.attr('src', imageLocale(src))
  })
  // Un titre fait d'une image sans texte de remplacement n'annonce rien : l'image reste, dans un paragraphe
  $('h1, h2, h3, h4, h5, h6')
    .filter((_, el) => !$(el).text().trim() && $(el).find('img').length > 0 && !$(el).find('img[alt]:not([alt=""])').length)
    .each((_, el) => void (el.tagName = 'p'))
}

function poserTitres($: cheerio.CheerioAPI, niveauBoite = 3) {
  // Sous-titre gris en tête d'un volet (synonymes, « Journals »…) : pas un titre
  $('.volet-contenu > h3[style*="color:#aaaaaa"]').each((_, el) => {
    el.tagName = 'p'
    $(el).addClass('chapeau')
  })
  const titres = $('h2, h3, h4, h5, h6').not('.titre')
  titres.each((_, el) => {
    const niveau = Number(el.tagName[1])
    const decalage = $(el).parents('.volet-contenu').length
    el.tagName = `h${Math.min(Math.max(niveau + 1, 4) + decalage, 6)}`
  })
  // La source saute des niveaux : un titre ne descend que d'un cran à la fois 
  let precedent = niveauBoite
  $('h2, h3, h4, h5, h6').each((_, el) => {
    precedent = Math.min(Number(el.tagName[1]) - (3 - niveauBoite), precedent + 1)
    el.tagName = `h${precedent}`
  })
}

const ICONE_ANCRE = 'M117.18 188.74a12 12 0 0 1 0 17l-5.12 5.12A58.26 58.26 0 0 1 70.6 228a58.62 58.62 0 0 1-41.46-100.08l34.75-34.75a58.64 58.64 0 0 1 98.56 28.11a12 12 0 1 1-23.37 5.44a34.65 34.65 0 0 0-58.22-16.58l-34.75 34.75A34.62 34.62 0 0 0 70.57 204a34.4 34.4 0 0 0 24.49-10.14l5.11-5.12a12 12 0 0 1 17.01 0m109.68-161.6a58.66 58.66 0 0 0-82.94 0l-5.12 5.11a12 12 0 0 0 17 17l5.12-5.12a34.63 34.63 0 1 1 49 49l-34.76 34.76a34.63 34.63 0 0 1-58.22-16.58a12 12 0 0 0-23.37 5.44a58.64 58.64 0 0 0 98.56 28.11l34.75-34.75a58.62 58.62 0 0 0-.02-82.97'

/** Lien d'ancre placé à la fin d'un titre, comme dans bibweb : le clic copie aussi l'adresse (lib/ancres-copie.ts) */
export function lienAncre(id: string, texte: string) {
  return `<a class="ancre-titre" href="#${id}"><span class="visuellement-masque">Lien vers la section « ${echapper(texte)} »</span><svg aria-hidden="true" focusable="false" viewBox="0 0 256 256" width="1em" height="1em" fill="currentColor"><path d="${ICONE_ANCRE}"></path></svg></a>`
}

// Pas de lien dans un titre d'accordéon (son clic ouvre le volet) ni dans un titre déjà lien
function poserAncres(html: string, idUnique: (texte: string) => string) {
  const $ = cheerio.load(html, null, false)
  $('h2, h3').not('.titre').each((_, el) => {
    const titre = $(el)
    const texte = titre.text().trim()
    if (!texte || titre.closest('a, summary').length || titre.find('a').length === titre.contents().length) return
    const id = titre.attr('id') ?? idUnique(texte)
    titre.attr('id', id).addClass('titre-ancre').append(lienAncre(id, texte))
  })
  return $.html()
}

/** Les contenus d'une boîte se suivent : le saut de niveau peut aussi venir d'un contenu à l'autre */
function resserrerTitres(html: string, niveauBoite: number) {
  const $ = cheerio.load(html, null, false)
  let precedent = niveauBoite
  $('h2, h3, h4, h5, h6').each((_, el) => {
    precedent = Math.min(Number(el.tagName[1]), precedent + 1)
    el.tagName = `h${precedent}`
  })
  return $.html()
}

function nettoyerAttributs($: cheerio.CheerioAPI) {
  $(BALISES_RETIREES).remove()
  // Du plus profond au plus haut : déballer un parent ne dérange pas ses enfants déjà traités
  $('*')
    .toArray()
    .reverse()
    .forEach((el) => {
      const tag = el.tagName.toLowerCase()
      const garde = $(el)
      if (!BALISES_PERMISES.has(tag)) {
        const fontSize = garde.attr('style')?.match(/font-size:\s*(\d+)px/)
        if (tag === 'span' && fontSize && Number(fontSize[1]) <= 12) el.tagName = 'small'
        // Un passage dans une autre langue garde son span : le lecteur d'écran change de voix (WCAG 3.1.2)
        else if (!(tag === 'span' && LANGUE_ETRANGERE.test(garde.attr('lang') ?? ''))) return void garde.replaceWith(garde.contents())
      }
      const permis = ATTRIBUTS_PERMIS[el.tagName] ?? []
      for (const nom of Object.keys(el.attribs)) {
        if (nom === 'class' || (nom === 'lang' && LANGUE_ETRANGERE.test(el.attribs.lang))) continue
        if (nom !== 'id' && !permis.includes(nom)) delete el.attribs[nom]
      }
      // Sans rôle, le nom d'un <div> n'est pas annoncé
      if (!el.attribs.role) delete el.attribs['aria-label']
      const classes = (el.attribs.class ?? '').split(/\s+/).filter((c) => CLASSES_PERMISES.has(c))
      if (classes.length) el.attribs.class = classes.join(' ')
      else delete el.attribs.class
    })
}

function retirerVides($: cheerio.CheerioAPI) {
  $('ul > br, ol > br').remove()
  $('ul > img, ol > img').wrap('<li></li>')
  $('p, div, a, h2, h3, h4, h5, h6, li, ul, ol, strong, em, small')
    .toArray()
    .reverse()
    .forEach((el) => {
      const bloc = $(el)
      const aDuContenu = bloc.text().trim() !== '' || bloc.is('[id^="form_"], a[id], .titre-vide') || bloc.find('img, table, details, iframe, script').length > 0
      if (!aDuContenu) bloc.remove()
    })
  // Une même liste coupée en deux par l'éditeur
  $('ul + ul').each((_, el) => {
    $(el).prev().append($(el).contents())
    $(el).remove()
  })
}

function envelopperTableaux($: cheerio.CheerioAPI) {
  // La source laisse parfois un tableau vide devant le vrai
  $('table:not(:has(tr))').remove()
  $('tr')
    .filter((_, tr) => $(tr).text().trim() === '' && !$(tr).find('img').length)
    .remove()
  // Case d'angle : un en-tête vide n'annonce rien
  $('th')
    .filter((_, th) => !$(th).text().trim() && !$(th).find('img').length)
    .each((_, th) => {
      th.tagName = 'td'
      delete th.attribs.scope
    })
  // Première rangée toute en gras : c'est l'en-tête que la source n'a pas balisé (WCAG 1.3.1)
  const sansEspaces = (texte: string) => texte.replace(/\s/g, '')
  $('table:not(:has(th))').each((_, table) => {
    const rangees = $(table).find('tr')
    const remplies = rangees.first().children('td').filter((_, td) => $(td).text().trim() !== '')
    const enGras = remplies.toArray().every((td) => sansEspaces($(td).find('strong, b').not('strong *, b *').text()) === sansEspaces($(td).text()))
    if (rangees.length < 2 || remplies.length < 2 || !enGras) return
    remplies.each((_, td) => void (td.tagName = 'th')).attr('scope', 'col')
  })
  // Défilement au clavier si le tableau ou le code dépasse (WCAG 2.1.1)
  $('table').wrap('<div class="tableau" tabindex="0" role="region" aria-label="Tableau"></div>')
  $('thead th:not([scope])').attr('scope', 'col')
  $('pre').attr('tabindex', '0')
}

/** Chaque tableau est un repère de la page : son nom le distingue des autres */
function nommerTableaux(html: string, numero: () => number) {
  if (!html.includes('class="tableau"')) return html
  const $ = cheerio.load(html, null, false)
  $('.tableau').each((_, el) => {
    const legende = $(el).find('caption').first().text().replace(/\s+/g, ' ').trim()
    $(el).attr('aria-label', `Tableau ${numero()}${legende && ` : ${legende}`}`)
  })
  return $.html()
}

/** Liste de guides d'un widget LibGuides (son script au format JS) en menu déroulant de liens : elle n'a plus besoin de JavaScript */
export function menuWidget(js: string, titre: string) {
  const liens = [...js.matchAll(/<option value=\\"(http[^"]+?)\\">(.*?)<\\\/option>/g)].map(([, href, nom]) => {
    const [url, texte] = [href, nom].map((chaine) => JSON.parse(`"${chaine}"`) as string)
    return `<li><a href="${url}">${texte}</a></li>`
  })
  if (!liens.length) throw new Error(`LibGuides : widget « ${titre} » sans liste de guides`)
  return `<details class="menu-deroulant"><summary>${titre}</summary><ul>${liens.join('')}</ul></details>`
}

/** Guides d'un widget LibGuides affiché en liste (list_format=1) : le HTML est dans son script */
export function listeWidget(js: string, titre: string) {
  const contenu = js.match(/json_content = (\{.*?\});\s*$/m)?.[1]
  const html = contenu && (JSON.parse(contenu) as { content?: string }).content
  if (!html?.includes('<a ')) throw new Error(`LibGuides : widget « ${titre} » sans liste de guides`)
  return html
}

const RESUME_COURT = 240

const echapper = (texte: string) => texte.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')

/** Fil RSS ou Atom en liste de liens, avec la date et ce que le site actuel met dans sa bulle d'information */
export function listeFil(xml: string, nombre: number) {
  const $ = cheerio.load(xml, { xml: true })
  const articles = $('item, entry')
    .toArray()
    .slice(0, nombre)
    .map((el) => {
      const article = $(el)
      const lien = article.children('link[href]').attr('href') ?? article.children('link').text()
      const date = new Date(article.children('pubDate, published').first().text())
      const $description = cheerio.load(article.children('description').text())
      const paragraphes = $description('p:not(:has(small))').toArray().map((p) => $description(p).text().replace(/\s+/g, ' ').trim())
      const details = article.is('item')
        ? (paragraphes.length ? paragraphes : [$description.root().text().replace(/\s+/g, ' ').trim()])
        : article.children('author').toArray().map((auteur) => $(auteur).children('name').text().trim())
      const quand = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-CA', { dateStyle: 'long', timeZone: 'America/Montreal' })
      const texte = details.filter(Boolean).join(' · ')
      // Auteur et éditeur restent visibles ; un long résumé (revue, blogue) va dans un dépliant, comme pour les livres
      const infos = !texte ? '' : texte.length > RESUME_COURT ? `<details class="ressource-plus"><summary>Description</summary><div class="ressource-description">${echapper(texte)}</div></details>` : `<small>${echapper(texte)}</small>`
      return `<li><a href="${echapper(lien.trim())}">${echapper(article.children('title').first().text().trim())}</a>${infos}${quand ? `<small class="fil-date">${echapper(quand)}</small>` : ''}</li>`
    })
  return articles.length ? `<ul class="fil-nouvelles">${articles.join('')}</ul>` : ''
}

interface Ressource {
  type_id: number
  name?: string
  description?: string
  url?: string
  meta?: { more_info?: string; embed_code?: string; file_name?: string; author?: string; pub_date?: string; call_number?: string; isbn?: string; cover_url?: string; tn_url?: string; tn_alt_text?: string }
}

/** Lien, document, livre, base de données ou média : l'API donne le contenu, la page publique le lien final (proxy, document hébergé) */
export function htmlRessource(a: Ressource, href: string | undefined, icones = '') {
  const nom = echapper((a.name ?? '').trim())
  const m = a.meta ?? {}
  const description = [a.description, m.more_info].filter((t) => t?.trim()).map((t) => `<div class="ressource-description">${t}</div>`).join('')
  const lien = `<a href="${echapper(href ?? a.url ?? '')}">${nom}</a>`
  if (a.type_id === 9) return (m.embed_code ?? '').replace(/<iframe(?![^>]*\stitle=)/i, `<iframe title="${nom}"`) + description
  if (a.type_id === 5) {
    const couverture = m.cover_url ? `<img class="couverture" src="${echapper(m.cover_url)}" alt="">` : ''
    const details = [m.author, m.pub_date, m.call_number && `Cote : ${m.call_number}`, m.isbn && `ISBN : ${m.isbn}`].filter(Boolean).map((d) => echapper(String(d))).join(' · ')
    return `<ul class="liste-ressources"><li class="livre">${couverture}<div>${lien}${icones}${details ? `<small>${details}</small>` : ''}${description && `<details class="ressource-plus"><summary>Description</summary>${description}</details>`}</div></li></ul>`
  }
  const extension = a.type_id === 4 ? m.file_name?.split('.').pop()?.toUpperCase() : undefined
  if (m.tn_url) {
    const vignette = `<img class="couverture" src="${echapper(m.tn_url)}" alt="${echapper(m.tn_alt_text ?? '')}">`
    return `<ul class="liste-ressources"><li class="livre">${vignette}<div>${lien}${icones}${description}</div></li></ul>`
  }
  return `<ul class="liste-ressources"><li>${lien}${extension ? ` <small class="ressource-type">(${echapper(extension)})</small>` : ''}${icones}${description}</li></ul>`
}

/**
 * Carrousel LibGuides (boîte sans asset, s-lib-cpane-…) selon le motif de Carousel1 de bibweb :
 * une piste à défilement natif, sans défilement automatique. Boutons posés par le script de Base.
 */
export function carrouselDepuis(html: string, titre: string) {
  const $ = cheerio.load(html, null, false)
  const diapos = $('[id^="s-lib-cpane-"]')
    .children()
    .toArray()
    .map((el) => {
      const diapo = $(el)
      const legende = diapo.find('.s-lib-cpane-caption').first().html()?.trim() ?? ''
      const alt = legende ? '' : (diapo.find('img').attr('alt') ?? '')
      const src = diapo.find('img').attr('src')
      return `<li>${src ? `<img src="${echapper(imageLocale(src))}" alt="${echapper(alt)}">` : ''}<div>${legende.replace(/<(\/?)h[1-6]\b[^>]*>/g, '<$1p>')}</div></li>`
    })
  return `<div class="carrousel" role="group" aria-roledescription="carrousel" aria-label="${echapper(titre || 'Carrousel')}"><ul class="carrousel-piste" tabindex="0">${diapos.join('')}</ul></div>`
}

interface Vignette {
  photo?: string
  nom: string
  href?: string
  detail: string
}

/**
 * Tableau « Vos bibliothécaires » (classes name-cell, col-nom) en vignettes, comme l'équipe d'une
 * bibliothèque dans bibweb. `trouver` reçoit le nom de la source, écrit « Prénom NOM », et la photo
 * et le texte de la source si la personne n'est pas au répertoire.
 */
export function equipeDepuis(html: string, trouver: (nom: string, photo: string | undefined, fonction: string) => Vignette) {
  if (!/name-cell|col-nom/.test(html)) return html
  const $ = cheerio.load(html, null, false)
  $('table:has(.name-cell), table:has(.col-nom)').each((_, table) => {
    const vignettes = $(table)
      .find('tr:has(td)')
      .toArray()
      .flatMap((tr) => {
        const cases = $(tr).children('td')
        const source = cases.first().text().replace(/\s+/g, ' ').trim()
        if (!source) return []
        const [nom, prenom] = source.split(/,\s*/)
        const v = trouver(prenom ? `${prenom} ${nom}` : source, cases.first().find('img').attr('src'), cases.eq(1).text().replace(/\s+/g, ' ').trim())
        const libelle = echapper(v.nom)
        return [`<li class="vignette">${v.photo ? `<img class="vignette-photo" src="${echapper(v.photo)}" alt="">` : ''}<p class="vignette-nom">${v.href ? `<a href="${echapper(v.href)}">${libelle}</a>` : libelle}</p>${v.detail ? `<p class="vignette-detail">${echapper(v.detail)}</p>` : ''}</li>`]
      })
    $(table).replaceWith(`<ul class="equipe">${vignettes.join('')}</ul>`)
  })
  $('table').each((_, t) => void (!$(t).find('tr').length && $(t).remove()))
  return $.html()
}

export function nettoyerContenu(html: string, idAsset: number, idPage: string, ctx: Contexte, ancres: Map<string, string>) {
  const $ = cheerio.load(html, null, false)
  $('*')
    .contents()
    .filter((_, n) => n.type === 'comment')
    .remove()

  convertirAccordeonsJquery($)
  convertirReponsesJson($)
  convertirVisionneuses($)
  $('script').not(SCRIPT_PERMIS).remove()
  aplatirAccordeons($)
  poserIframes($, ctx.titreBoite)
  poserDisposition($)
  poserAlertes($)
  poserImages($)
  if (!ctx.titresIntacts) poserTitres($, ctx.niveauBoite)

  $('a[href]').each((_, el) => {
    const href = reecrireLien($(el).attr('href')!, ctx, ancres, idAsset, idPage)
    // Rien de visible (espaces de largeur nulle) : le lien n'a plus de destination et disparaît plus bas
    const invisible = /^[\s​-‍⁠﻿]*$/.test($(el).text()) && !$(el).find('img, svg, iframe, video').length
    if (href && !invisible) $(el).attr('href', href)
    else $(el).removeAttr('href')
  })
  // La source répète parfois un id dans un même asset : le premier garde l'ancre
  const vus = new Set<string>()
  $('a[name]:not([id])').each((_, el) => void $(el).attr('id', $(el).attr('name')!))
  $('[id]:not([id^="form_"])').each((_, el) => {
    const id = $(el).attr('id')!
    if (vus.has(id)) return void $(el).removeAttr('id')
    vus.add(id)
    $(el).attr('id', ID_LOCAL(idAsset, id))
  })
  // Panneau d'une boîte réutilisée dans un onglet : sans onglet qui le commande, ce n'est plus qu'un bloc
  $('[role="tabpanel"]').removeAttr('role').removeAttr('tabindex')
  // Lien sans destination (href="#", adresse refusée) : le texte reste, sans passer pour un lien ; un « . » isolé (fermeture d'une visionneuse) disparaît
  $('a:not([href]):not([id])').each((_, el) => {
    const lien = $(el)
    if (/[\p{L}\p{N}]/u.test(lien.text()) || lien.find('img').length) lien.replaceWith(lien.contents())
    else lien.remove()
  })

  nettoyerAttributs($)
  // Les déballages laissent parfois des nœuds voisins incohérents, qui font planter les sélecteurs « a + b »
  const $propre = cheerio.load($.html(), null, false)
  retirerVides($propre)
  envelopperTableaux($propre)

  return $propre.html().trim()
}

/** Fiche ou responsable d'un guide écrit en commun : une équipe, pas une personne */
export const estCollectif = (nom: string) => /^(nous joindre|notre équipe|bibliothèques udem|bibliothécaires en |équipe |soutien pour )/i.test(nom.trim())

/** Titre d'une fiche : les variantes du même métier (« Votre bibliothécaire », « Bibliothécaire disciplinaire »…) n'en font qu'un */
export const titreFiche = (titre: string) => (/^(votre |vos )?bibliothécaires?( disciplinaire)?\s*:?$/i.test(titre.trim()) ? 'Bibliothécaire' : titre)

/** Adresses d'un lien mailto, sans sujet ; le « ; » de la source n'est pas fiable partout, la virgule l'est */
export const adressesDe = (href: string) => href.replace(/^mailto:/i, '').split('?')[0].split(/[;,]/).map((a) => a.trim()).filter(Boolean)

export const slugifier = (texte: string) => texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Chemin de chaque page : la première à la racine, les autres d'après leur nom */
export function cheminsDes(pages: { id: string; nom: string }[], racine = '/') {
  const chemins = new Map<string, string>()
  const pris = new Set([racine])
  pages.forEach(({ id, nom }, i) => {
    const slug = slugifier(nom)
    const chemin = i === 0 ? racine : pris.has(`${racine}${slug}/`) || !slug ? `${racine}${slug}-${id}/` : `${racine}${slug}/`
    pris.add(chemin)
    chemins.set(id, chemin)
  })
  return chemins
}

export function nettoyerGuide(sections: SectionBrute[], ctx: Contexte) {
  // Une ancre #button1-2 n'est unique que dans son asset : on la résout par page
  const ancres = new Map<string, string>()
  for (const section of sections)
    for (const boite of section.boites)
      for (const contenu of boite.contenus)
        for (const [, id] of contenu.html.matchAll(/\b(?:id|name)="([^"]+)"/g)) {
          const cle = `${section.id}#${id}`
          if (!ancres.has(cle)) ancres.set(cle, ID_LOCAL(contenu.id, id))
        }

  return sections.map((section) => {
    // Identifiants lisibles et stables d'un build à l'autre, uniques dans la page
    const pris = new Set<string>()
    const idUnique = (texte: string) => {
      const base = slugifier(texte) || 'section'
      let id = base
      for (let i = 1; pris.has(id); i++) id = `${base}-${i}`
      pris.add(id)
      return id
    }
    const idTitre = idUnique(section.nom)
    let tableaux = 0
    const rendre = (boite: SectionBrute['boites'][number], contenus: SectionBrute['boites'][number]['contenus']) => {
      const niveauBoite = (boite.nom ? 3 : 2) - (ctx.portail ? 1 : 0)
      const html = nommerTableaux(
        contenus
          .map((c) => nettoyerContenu(c.html, c.id, section.id, { ...ctx, niveauBoite, titreBoite: boite.nom }, ancres))
          .join('\n')
          // Des ressources voisines forment une seule liste, comme sur le site actuel
          .replaceAll('</ul>\n<ul class="liste-ressources">', ''),
        () => ++tableaux,
      )
      return ctx.titresIntacts ? html : poserAncres(resserrerTitres(html, niveauBoite), idUnique)
    }
    return {
      id: section.id,
      nom: section.nom,
      idTitre,
      chemin: ctx.chemins.get(section.id)!,
      parent: section.parent,
      profils: section.profils ?? [],
      boites: section.boites
        .map((boite) => {
          const onglets = new Map(boite.contenus.flatMap((c) => (c.onglet ? [[c.onglet.id, c.onglet.nom]] : [])) as [string, string][])
          return {
            id: boite.id,
            nom: boite.nom,
            ancre: boite.ancre,
            idTitre: boite.nom ? idUnique(boite.nom) : undefined,
            html: rendre(boite, boite.contenus.filter((c) => !c.onglet)),
            onglets: [...onglets]
              .map(([id, nom]) => ({ id, nom, html: rendre(boite, boite.contenus.filter((c) => c.onglet?.id === id)) }))
              .filter((onglet) => onglet.html),
          }
        })
        .filter((boite) => boite.html || boite.onglets.length),
    }
  })
}
