import assert from 'node:assert/strict'
import { test } from 'node:test'
import { adressesDe, carrouselDepuis, cheminsDes, equipeDepuis, estCollectif, htmlRessource, listeFil, listeWidget, menuWidget, nettoyerContenu, nettoyerGuide, reecrireLien, titreFiche } from './nettoyage.ts'

const ctx = { idGuide: 748086, urlGuide: 'https://boite-outils.bib.umontreal.ca/trouver-evaluer/fiabilite-information', chemins: new Map([['10', '/'], ['20', '/vingt/']]) }
const propre = (html: string, ancres = new Map<string, string>()) => nettoyerContenu(html, 1, '10', ctx, ancres)

test('retire scripts, gestionnaires, styles et liens javascript', () => {
  const html = propre('<p style="color:red" onclick="x()">a<script>alert(1)</script> <a href="javascript:alert(1)">b</a></p>')
  assert.equal(html, '<p>a b</p>')
})

test('titre de fiche : une seule forme pour bibliothécaire, les autres titres restent', () => {
  for (const titre of ['Votre bibliothécaire', 'Votre bibliothécaire ', 'Vos bibliothécaires', 'Bibliothécaire', 'Bibliothécaire ', 'Bibliothécaire disciplinaire', 'bibliothécaire :']) assert.equal(titreFiche(titre), 'Bibliothécaire', titre)
  for (const titre of ['Librarian', 'Bibliothécaire formateur', 'Bibliothécaire - Santé publique', 'Technicien(ne) en documentation', 'Équipe de soutien REL - Volet projet']) assert.equal(titreFiche(titre), titre)
})

test('bloc avec fond et marge interne : un encadré, sauf sur fond blanc ou déjà mis en forme', () => {
  const bloc = (style: string, classe = '') => `<div class="${classe}" style="${style}"><p>Texte</p></div>`
  assert.equal(propre(bloc('background: linear-gradient(to top, #014B97, #3A78B8); padding: 10pt; color: white')), '<div class="encadre"><p>Texte</p></div>')
  assert.equal(propre(bloc('float: right; background-color: tomato; padding: 4px')), '<div class="flottante-droite encadre"><p>Texte</p></div>')
  assert.equal(propre(bloc('background: white; padding: 4px')), '<div><p>Texte</p></div>')
  assert.equal(propre(bloc('background: tomato')), '<div><p>Texte</p></div>')
  assert.equal(propre(bloc('background: tomato; padding: 4px', 'tuile-wrapper')), '<div class="tuile-wrapper"><p>Texte</p></div>')
  // Un seul cadre, pas un cadre dans un cadre
  assert.equal(propre(`<div style="background: tomato; padding: 4px">${bloc('background: beige; padding: 4px')}</div>`), '<div class="encadre"><div><p>Texte</p></div></div>')
})

test('exemple JSON affiché par un bouton : un <details> rempli au build, sans script', () => {
  const html = propre(`<p><button id="b">Afficher la réponse</button></p><pre id="r" style="display: none;"> &nbsp;</pre><script>
const ex= {
  "a": { "b": "<c>\\u2019" }
};
const bouton = document.getElementById('b');
const bloc = document.getElementById('r');
bouton .addEventListener('click', () => { bloc .textContent = JSON.stringify(ex, null, 2); });
</script>`)
  assert.equal(html, `<details class="ressource-plus"><summary>Afficher la réponse</summary><pre tabindex="0">{\n  "a": {\n    "b": "&lt;c&gt;’"\n  }\n}</pre></details>`)
})

test('exemple JSON illisible : rien ne plante et le script disparaît', () => {
  const html = propre(`<p><button id="b">Voir</button></p><pre id="r"> x</pre><script>
const ex= {
  a: 1
};
const bouton = document.getElementById('b');
const bloc = document.getElementById('r');
bouton .addEventListener('click', () => { bloc .textContent = JSON.stringify(ex); });
</script>`)
  assert.ok(!html.includes('<script'))
  assert.ok(html.includes('Voir'))
})

test('visionneuse de la source : la vignette mène à l\'image, qui ne reste pas dans la page', () => {
  const html = propre(`<figure><a href="#lb-x"><img alt="Clé" class="thumb" src="https://i.org/v.png" style="width: 316px;" /></a><figcaption>Cliquer pour agrandir</figcaption></figure>
<div class="lb" id="lb-x"><a class="close" href="#">.</a><div class="content"><img alt="Clé" src="https://i.org/o.png" /><div>Cliquer n'importe où pour fermer</div></div></div>`)
  assert.ok(html.includes('<a href="https://i.org/o.png" class="image-agrandie"><img'))
  assert.ok(html.includes('src="https://i.org/v.png"'))
  assert.ok(!html.includes('fermer'))
  assert.equal(html.match(/<img/g)?.length, 1)
})

test('seul un lien-image vers une image s\'agrandit', () => {
  assert.ok(propre('<a href="https://i.org/a.JPG?x=1"><img alt="a" src="https://i.org/m.jpg"></a>').includes('class="image-agrandie"'))
  assert.ok(!propre('<a href="https://i.org/page"><img alt="a" src="https://i.org/m.jpg"></a>').includes('image-agrandie'))
  assert.ok(!propre('<a href="https://i.org/a.png">Voir<img alt="a" src="https://i.org/m.jpg"></a>').includes('image-agrandie'))
})

test('réécrit les liens internes au guide et laisse les autres absolus', () => {
  const ancres = new Map([['20#button1-2', 'a9-button1-2']])
  const lien = (href: string) => reecrireLien(href, ctx, ancres, 1, '10')
  assert.equal(lien(`${ctx.urlGuide}?p=20`), '/vingt/')
  assert.equal(lien(`${ctx.urlGuide}?p=20#button1-2 `), '/vingt/#a9-button1-2')
  assert.equal(lien('https://boite-outils.bib.umontreal.ca/c.php?g=748086&p=20&preview=abc'), '/vingt/')
  assert.equal(lien(`${ctx.urlGuide}?p=20#s-lg-box-5`), '/vingt/#s-lg-box-5')
  assert.equal(lien(`${ctx.urlGuide}?p=10#s-lg-box-5`), '#s-lg-box-5')
  assert.equal(lien(`${ctx.urlGuide}?p=99`), `${ctx.urlGuide}?p=99`)
  assert.equal(lien('/az.php'), '/bases-de-donnees/')
  assert.equal(lien('https://boite-outils.bib.umontreal.ca/az.php?q=eureka&p=2&_gl=x'), '/bases-de-donnees/?q=eureka')
  assert.equal(lien('https://boite-outils.bib.umontreal.ca/az.php?s=136604&t=27958&a=b'), '/bases-de-donnees/?s=136604&t=27958&a=b')
  assert.equal(lien('https://exemple.org/a'), 'https://exemple.org/a')
  assert.equal(lien('#local'), '#a1-local')
})

test('accordéon de la source en <details>, y compris un volet mal fermé', () => {
  const html = propre(`<div class="accordion-item"><h3><button class="titre-accordion" id="button1-1">Un</button></h3>
    <div class="accordion-content"><p>a</p></div>
    <div class="accordion-custom"><div class="accordion-item"><h3><button class="titre-accordion" id="button1-2">Deux</button></h3>
    <div class="accordion-content"><h3>Sous</h3><p>b</p></div></div></div></div>`)
  assert.equal(html.match(/<details/g)?.length, 2)
  assert.ok(!html.includes('<button'))
  assert.ok(html.includes('id="a1-button1-1"') && html.includes('id="a1-button1-2"'))
  assert.ok(html.indexOf('Un') < html.indexOf('Deux'))
  assert.ok(html.includes('<h5>Sous</h5>'), 'un titre de contenu passe sous celui du volet')
  assert.ok(!/<details[^>]*>(?:(?!<\/details>).)*<details/s.test(html), 'les volets ne sont plus imbriqués')
})

test('images de la source conservées, avec leur version texte et leur disposition', () => {
  const html = propre('<p style="text-align:center"><img alt="SIFT" src="https://x/SIFT-complet.svg" style="width: 600px" /></p><div class="accessible-toggle"><details><summary>Voir</summary><p>t</p></details></div><h3><img alt="S : S\'arrêter" src="https://x/Oriflamme-S.svg" style="float:left;width:100px" /> S\'arrêter</h3><ul style="margin-left:120px"><li>a</li></ul>')
  assert.ok(html.includes('<p class="centre"><img alt="SIFT" src="https://x/SIFT-complet.svg" width="600" loading="lazy"></p>'))
  assert.ok(html.includes('<details>'))
  assert.ok(html.includes('src="https://x/Oriflamme-S.svg"') && html.includes('class="flottante"'))
  assert.ok(html.includes('>S\'arrêter</h4>') && html.includes('<ul class="retrait">'))
})

test('encadrés gris fusionnés, sans émoji ; paragraphes vides retirés ; listes recollées', () => {
  const html = propre('<div style="background:#eeeeee">⚠️ Un</div><div style="background:#eeeeee;">Deux</div><p>&nbsp;</p><ul><li>a</li></ul><ul><li>b</li></ul>')
  assert.equal(html, '<div class="alerte"><p>Un</p><p>Deux</p></div><ul><li>a</li><li>b</li></ul>')
})

test('nettoyerGuide résout une ancre vers l\'asset d\'une autre page et écarte les boîtes vides', () => {
  const lien = `<p><a href="${ctx.urlGuide}?p=2#button1-2">x</a></p>`
  const volet = '<div class="accordion-item"><h3><button class="titre-accordion" id="button1-2">T</button></h3><div class="accordion-content"><p>c</p></div></div>'
  const [a, b] = nettoyerGuide(
    [
      { id: '1', nom: 'A', boites: [{ id: '10', nom: 'B', contenus: [{ id: 7, html: lien }] }, { id: '11', nom: '', contenus: [{ id: 8, html: '' }] }] },
      { id: '2', nom: 'C', boites: [{ id: '20', nom: 'D', contenus: [{ id: 9, html: volet }] }] },
    ],
    { ...ctx, chemins: new Map([['1', '/'], ['2', '/deux/']]) },
  )
  assert.equal(a.boites.length, 1)
  assert.ok(a.boites[0].html.includes('href="/deux/#a9-button1-2"'))
  assert.ok(b.boites[0].html.includes('id="a9-button1-2"'))
})

test('ne saute aucun niveau de titre et garde des ancres uniques', () => {
  const volet = (id: string, corps: string) =>
    `<div class="accordion-item"><h3><button class="titre-accordion" id="${id}">T</button></h3><div class="accordion-content">${corps}</div></div>`
  const html = propre(volet('button1-3', '<h4>Sous-titre</h4><p>a</p>') + volet('button1-3', '<p>b</p>'))
  assert.match(html, /<h4 class="titre">T<\/h4>.*<h5>Sous-titre<\/h5>/s)
  assert.equal(html.match(/id="a1-button1-3"/g)?.length, 1)
})

test('encadré gris sans ⚠️ : pas présenté comme un avertissement', () => {
  assert.equal(propre('<div style="background:#eeeeee">Exemple</div>'), '<div class="encadre"><p>Exemple</p></div>')
})

test('exemple ou annonce : encadré à part, jamais un avertissement, même avec un ⚠️ dans le texte', () => {
  const gris = (texte: string) => `<div style="background:#eeeeee">${texte}</div>`
  assert.equal(propre(gris('<p>⚙️Exemple</p><p>⚠️ Attention ici</p>')), '<div class="encadre"><p>⚙️Exemple</p><p>Attention ici</p></div>')
  assert.equal(propre(gris('<p>🌟Nouveau ⚠️ a</p>')), '<div class="encadre"><p>🌟Nouveau a</p></div>')
  assert.equal(propre(gris('⚠️ Un') + gris('⚙️ Deux')), '<div class="alerte"><p>Un</p></div><div class="encadre"><p>⚙️ Deux</p></div>')
  assert.equal(propre(gris('⚙️ Un') + gris('⚠️ Deux')), '<div class="encadre"><p>⚙️ Un</p></div><div class="alerte"><p>Deux</p></div>')
})

test('chemins des pages : première à la racine, sans accent, sans collision', () => {
  const pages = [['1', 'À savoir'], ['2', 'Évaluer ses sources '], ['3', 'Évaluer ses sources'], ['4', '…']].map(([id, nom]) => ({ id, nom }))
  assert.deepEqual([...cheminsDes(pages).values()], ['/', '/evaluer-ses-sources/', '/evaluer-ses-sources-3/', '/-4/'])
})

test('onglets : regroupés dans l\'ordre, sans perdre les liens qui les visent', () => {
  const onglet = (i: number) => ({ id: `s-lib-ctab-5-${i}`, nom: `O${i}` })
  const [section] = nettoyerGuide(
    [{ id: '10', nom: 'A', boites: [{ id: '5', nom: 'B', contenus: [
      { id: 1, html: '<p>a</p>', onglet: onglet(0) },
      { id: 2, html: '<p>b</p>', onglet: onglet(1) },
      { id: 3, html: '<p>c</p>', onglet: onglet(0) },
      { id: 4, html: '', onglet: onglet(2) },
    ] }] }],
    ctx,
  )
  assert.equal(section.boites[0].html, '')
  assert.deepEqual(section.boites[0].onglets.map((o) => [o.nom, o.html]), [['O0', '<p>a</p>\n<p>c</p>'], ['O1', '<p>b</p>']])
  assert.equal(reecrireLien(`${ctx.urlGuide}?p=20#s-lib-ctab-5-1`, ctx, new Map(), 1, '10'), '/vingt/#s-lib-ctab-5-1')
})

test('accueil : titres intacts, chemins sous une racine, lien vers un guide déjà migré', () => {
  const accueil = { ...ctx, urlGuide: 'https://boite-outils.bib.umontreal.ca/accueil', titresIntacts: true, racines: new Map([['/trouver-evaluer/fiabilite-information', '/trouver-evaluer/fiabilite-information/'], ['/disciplines', '/disciplines/']]) }
  assert.equal(nettoyerContenu('<h2 class="titre-accueil">I</h2>', 1, '10', accueil, new Map()), '<h2 class="titre-accueil">I</h2>')
  assert.equal(reecrireLien('https://boite-outils.bib.umontreal.ca/trouver-evaluer/fiabilite-information', accueil, new Map(), 1, '10'), '/trouver-evaluer/fiabilite-information/')
  assert.equal(reecrireLien('https://boite-outils.bib.umontreal.ca/disciplines', accueil, new Map(), 1, '10'), '/disciplines/')
  assert.equal(reecrireLien('https://boite-outils.bib.umontreal.ca/autre-guide', accueil, new Map(), 1, '10'), 'https://boite-outils.bib.umontreal.ca/autre-guide')
  assert.deepEqual([...cheminsDes([{ id: '1', nom: 'A' }, { id: '2', nom: 'B c' }], '/x/y/').values()], ['/x/y/', '/x/y/b-c/'])
})

test('boîte sans titre affiché : son contenu ne saute pas de niveau', () => {
  const [section] = nettoyerGuide([{ id: '10', nom: 'A', boites: [{ id: '5', nom: '', contenus: [{ id: 1, html: '<h3>T</h3><h3>U</h3>' }] }] }], ctx)
  assert.deepEqual(section.boites[0].html.match(/<h\d id="\w+"/g), ['<h3 id="t"', '<h3 id="u"'])
})

test('widget de liste de guides : menu déroulant de liens, échec s\'il est vide', () => {
  const js = String.raw`x='<option value=\"\">Choisir<\/option><option value=\"https:\/\/boite-outils.bib.umontreal.ca\/citer\/apa\">APA \u00e9<\/option>'`
  const html = nettoyerContenu(menuWidget(js, 'Choisir'), 1, '10', ctx, new Map())
  assert.ok(html.startsWith('<details class="menu-deroulant"><summary>Choisir</summary>'))
  assert.ok(html.includes('<a href="https://boite-outils.bib.umontreal.ca/citer/apa">APA é</a>'))
  assert.throws(() => menuWidget('rien', 'Choisir'))
})

test('portail : titres sous le h2 de la boîte ; lien ?p= vers un guide migré ; lien vide retiré', () => {
  const portail = { ...ctx, urlGuide: 'https://boite-outils.bib.umontreal.ca/citer', chemins: new Map([['10', '/citer/']]), portail: true, pagesLocales: new Map([['20', '/g/vingt/']]) }
  const volet = '<div class="accordion-item"><h3><button class="titre-accordion">T</button></h3><div class="accordion-content"><p>a</p></div></div>'
  const [boites] = nettoyerGuide([{ id: '10', nom: 'A', boites: [{ id: '5', nom: 'B', contenus: [{ id: 1, html: volet }] }, { id: '6', nom: '', contenus: [{ id: 2, html: '<h2>H</h2>' }] }] }], portail).map((s) => s.boites)
  assert.match(boites[0].html, /<h3 class="titre">T<\/h3>/)
  assert.match(boites[1].html, /^<h2 id="h" class="titre-ancre">H</)
  assert.equal(reecrireLien('https://boite-outils.bib.umontreal.ca/autre?p=20#x', portail, new Map(), 1, '10'), '/g/vingt/')
  assert.equal(nettoyerContenu('<p>a</p><a href="https://x.org/"></a>', 1, '10', portail, new Map()), '<p>a</p>')
})

test('fils RSS et Atom : nombre, date à Montréal, détails, contenu échappé', () => {
  const rss = `<rss><channel><item><title><![CDATA[A <b>&]]></title><description><![CDATA[<div><p>Auteur</p><p>Éditeur</p><p><small>date</small></p></div>]]></description><link>https://x.org/1</link><pubDate>Sat, 31 Oct 2026 00:00:00 GMT</pubDate></item><item><title>B</title><link>https://x.org/2</link></item></channel></rss>`
  assert.equal(listeFil(rss, 1), '<ul class="fil-nouvelles"><li><a href="https://x.org/1">A &lt;b>&amp;</a><small>Auteur · Éditeur</small><small class="fil-date">30 octobre 2026</small></li></ul>')
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>C</title><link href="https://x.org/3" rel="alternate"/><author><name>Nom</name></author><published>2026-10-01T00:00:00Z</published></entry></feed>`
  assert.equal(listeFil(atom, 5), '<ul class="fil-nouvelles"><li><a href="https://x.org/3">C</a><small>Nom</small><small class="fil-date">30 septembre 2026</small></li></ul>')
  assert.equal(listeFil('<rss></rss>', 5), '')
  // Sans date, un long résumé n'est pas pris pour une date : il va dans le dépliant
  const long = 'mot '.repeat(80)
  const revue = listeFil(`<rdf:RDF><item><title>N</title><link>https://x.org/n</link><description><![CDATA[<img src="c.jpg"><p>${long}</p>]]></description></item></rdf:RDF>`, 5)
  assert.ok(revue.includes('<details class="ressource-plus"><summary>Description</summary>') && !revue.includes('fil-date') && !revue.includes('<small>'))
  // Description en texte simple, sans paragraphe
  assert.ok(listeFil('<rss><channel><item><title>T</title><link>https://x.org/t</link><description>Court résumé</description></item></channel></rss>', 5).includes('<small>Court résumé</small>'))
})

test('widget en liste : HTML lu dans son script ; tableau vide retiré', () => {
  const js = `this.json_content = {"content":"<ul><li><a href=\\"https:\\/\\/x.org\\/1\\">D\\u00e9mo<\\/a><\\/li><\\/ul>"};\nsuite`
  assert.equal(listeWidget(js, 'x'), '<ul><li><a href="https://x.org/1">Démo</a></li></ul>')
  assert.throws(() => listeWidget('rien', 'x'))
  assert.ok(!propre('<table></table><table><tr><td>a</td></tr></table>').includes('<table></table>'))
  assert.equal(propre('<table><tr><td>a</td></tr><tr><td> </td></tr></table>').match(/<tr>/g)?.length, 1)
})

test('types de contenu : lien, document, livre, base, média', () => {
  assert.equal(htmlRessource({ type_id: 2, name: 'A & B', url: 'https://x.org/' }, 'https://x.org/p'), '<ul class="liste-ressources"><li><a href="https://x.org/p">A &amp; B</a></li></ul>')
  assert.match(htmlRessource({ type_id: 4, name: 'Doc', meta: { file_name: 'a.pdf' } }, 'https://x.org/ld'), /<small class="ressource-type">\(PDF\)<\/small>/)
  const livre = htmlRessource({ type_id: 5, name: 'L', url: 'https://x.org/l', meta: { isbn: '123', cover_url: '//c.org/i.gif' } }, undefined)
  assert.ok(livre.includes('<img class="couverture" src="//c.org/i.gif" alt="">') && livre.includes('ISBN : 123'))
  assert.match(htmlRessource({ type_id: 10, name: 'B', description: 'D', meta: { more_info: 'M' } }, 'https://x.org/b'), /D<\/div><div class="ressource-description">M/)
  assert.ok(htmlRessource({ type_id: 9, name: 'V', meta: { embed_code: '<iframe src="https://y.org"></iframe>' } }, undefined).includes('title="V"'))
})

test('iframes et scripts : sources connues gardées, inconnues en lien, scripts retirés sauf LibWizard', () => {
  const video = propre('<p><iframe width="560" src="//www.youtube.com/embed/x" onload="x()"></iframe></p>')
  assert.equal(video, '<p><iframe width="560" src="https://www.youtube.com/embed/x" title="Contenu intégré" loading="lazy"></iframe></p>')
  assert.equal(propre('<iframe src="https://inconnu.org/a" title="T"></iframe>'), '<a href="https://inconnu.org/a">T</a>')
  assert.equal(propre('<script>alert(1)</script><script src="https://mal.org/x.js"></script><p>a</p>'), '<p>a</p>')
  const quiz = propre('<div id="form_ab" aria-hidden="true"> </div><script src="https://umontreal.libwizard.com/form_loader.php?id=ab"></script>')
  assert.ok(quiz.includes('<div id="form_ab">') && quiz.includes('form_loader.php?id=ab'))
})

test('accordéon jQuery UI converti ; texte réservé aux lecteurs d\'écran retiré', () => {
  const html = propre('<script>$( function() { $("#accordion2").accordion({collapsible: true}); });</script><div id="accordion2"><h3>T</h3><div><p>c</p></div></div>')
  assert.ok(html.includes('<details') && html.includes('>T</h') && html.includes('<p>c</p>') && !html.includes('accordion('))
  assert.equal(propre('<p>a<span class="sr-only">b</span></p>'), '<p>a</p>')
})

test('liens entre guides : page, racine, adresse c.php, page masquée, ancre', () => {
  const site = { ...ctx, pagesLocales: new Map([['77', '/autre/page/']]), racines: new Map([['/autre', '/autre/'], ['g:5', '/cinq/']]) }
  const lien = (href: string) => reecrireLien(href, site, new Map(), 1, '10')
  const base = 'https://boite-outils.bib.umontreal.ca'
  assert.equal(lien(`${base}/autre?p=77#s-lg-box-3`), '/autre/page/#s-lg-box-3')
  assert.equal(lien(`${base}/autre?p=77#button1-2`), '/autre/page/')
  assert.equal(lien(`${base}/autre/`), '/autre/')
  assert.equal(lien(`${base}/c.php?g=5`), '/cinq/')
  assert.equal(lien(`${base}/autre?p=99`), `${base}/autre?p=99`)
  assert.equal(lien(`${base}/ld.php?content_id=1`), `${base}/ld.php?content_id=1`)
})

test('ancres du contenu : conservées et préfixées, résolues entre assets d\'une page, onglets intacts', () => {
  assert.equal(propre('<h3 id="x">T</h3><a href="#x">l</a>'), '<h4 id="a1-x">T</h4><a href="#a1-x">l</a>')
  assert.equal(propre('<a name="y"></a><a href="#y">l</a>').includes('id="a1-y"'), true)
  assert.equal(propre('<a href="#s-lib-ctab-5-1">o</a>'), '<a href="#s-lib-ctab-5-1">o</a>')
  assert.equal(propre('<p><a href="#">v</a></p>'), '<p>v</p>')
  const [section] = nettoyerGuide([{ id: '10', nom: 'A', boites: [{ id: '5', nom: 'B', contenus: [{ id: 1, html: '<a href="#loin">l</a>' }, { id: 2, html: '<p id="loin">c</p>' }] }] }], ctx)
  assert.ok(section.boites[0].html.includes('href="#a2-loin"') && section.boites[0].html.includes('id="a2-loin"'))
})

test('titres resserrés d\'un contenu à l\'autre ; HTML retiré du texte de remplacement', () => {
  const [section] = nettoyerGuide([{ id: '10', nom: 'A', boites: [{ id: '5', nom: 'B', contenus: [{ id: 1, html: '<p>a</p>' }, { id: 2, html: '<h3>D</h3><h4>E</h4>' }] }] }], ctx)
  assert.equal(section.boites[0].html, '<p>a</p>\n<h4>D</h4><h5>E</h5>')
  const accordeon = '<div class="accordion-item"><h3><button class="titre-accordion">T</button></h3><div class="accordion-content"><h4>S</h4></div></div>'
  const [sautee] = nettoyerGuide([{ id: '10', nom: 'A', boites: [{ id: '5', nom: 'B', contenus: [{ id: 1, html: '<h3>U</h3>' }, { id: 2, html: accordeon }] }] }], ctx)
  assert.deepEqual(sautee.boites[0].html.match(/<h\d/g), ['<h4', '<h4', '<h5'])
  assert.ok(propre('<img src="https://x/a.png" alt="<h1>T</h1> suite">').includes('alt="T suite"'))
})

test('fiches : passées telles quelles à la page, hors du contenu', () => {
  const profil = { titre: 'Votre bibliothécaire', nom: 'A B', photo: '/images/personnel/a-b.webp', href: 'https://x.org/' }
  const [section] = nettoyerGuide([{ id: '10', nom: 'A', profils: [profil], boites: [] }], ctx)
  assert.equal(section.boites.length, 0)
  assert.deepEqual(section.profils, [profil])
})

test('livre : description dans un dépliant, absent sans description', () => {
  const avec = propre(htmlRessource({ type_id: 5, name: 'L', url: 'https://x.org/l', description: 'Résumé' }, undefined))
  assert.ok(avec.includes('<details class="ressource-plus"><summary>Description</summary><div class="ressource-description">Résumé</div></details>'))
  assert.ok(!avec.includes('class="volet"'))
  assert.ok(!htmlRessource({ type_id: 5, name: 'L', url: 'https://x.org/l' }, undefined).includes('<details'))
})

test('carrousel LibGuides : une diapositive par enfant, légende sans titre, attributs d\'accessibilité', () => {
  const source = '<div id="s-lib-cpane-1" aria-label="Slideshow"><div style="width:100%"><img src="https://x/a.jpg" alt="A" style="max-height:150px"><div class="s-lib-cpane-caption"><h3><a href="https://x.org/a">A</a></h3></div></div><div><img src="https://x/b.jpg" alt="B"></div></div>'
  const html = propre(carrouselDepuis(source, 'Suggestions'))
  assert.equal(html.match(/<li>/g)?.length, 2)
  assert.ok(html.includes('aria-roledescription="carrousel"') && html.includes('aria-label="Suggestions"'))
  assert.ok(html.includes('alt=""') && html.includes('alt="B"') && html.includes('<a href="https://x.org/a">A</a>') && !/<h\d/.test(html))
})

test('éléments flottants : le sens de la source est conservé, à droite comme à gauche', () => {
  assert.ok(propre('<ul><li><img src="https://x/a.png" style="width: 300px; float: right;" />t</li></ul>').includes('class="flottante-droite"'))
  assert.ok(propre('<p><img src="https://x/a.png" style="float:left" /> t</p>').includes('class="flottante"'))
  assert.ok(propre('<table style="float: right"><tr><td>a</td></tr></table>').includes('<table class="flottante-droite">'))
})

test('ancres des titres 2 et 3 : identifiants lisibles et uniques, pas dans les accordéons ni à l\'accueil', () => {
  const volet = '<div class="accordion-item"><h3><button class="titre-accordion">V</button></h3><div class="accordion-content"><p>c</p></div></div>'
  const [section] = nettoyerGuide([{ id: '10', nom: 'Évaluer', boites: [{ id: '5', nom: 'Évaluer', contenus: [{ id: 1, html: volet }] }, { id: '6', nom: '', contenus: [{ id: 2, html: '<h3>Déjà vu</h3><h3>Déjà vu</h3>' }] }] }], ctx)
  assert.equal(section.idTitre, 'evaluer')
  assert.equal(section.boites[0].idTitre, 'evaluer-1')
  assert.ok(!section.boites[0].html.includes('ancre-titre'))
  assert.match(section.boites[1].html, /<h3 id="deja-vu" class="titre-ancre">Déjà vu<a class="ancre-titre" href="#deja-vu">/)
  assert.match(section.boites[1].html, /id="deja-vu-1"/)
  const [accueil] = nettoyerGuide([{ id: '10', nom: 'A', boites: [{ id: '5', nom: '', contenus: [{ id: 1, html: '<h2>T</h2>' }] }] }], { ...ctx, titresIntacts: true })
  assert.equal(accueil.boites[0].html, '<h2>T</h2>')
})

test('colonnes Bootstrap : toutes les variantes deviennent col-md-N, grand écran d\'abord', () => {
  assert.ok(propre('<div class="row"><div class="col-xs-3 col-3">a</div></div>').includes('<div class="col-md-3">a</div>'))
  assert.ok(propre('<div class="col-12 col-md-4 col-lg-3">a</div>').includes('<div class="col-md-3">a</div>'))
  assert.ok(propre('<div class="col-md-5">a</div>').includes('<div class="col-md-5">a</div>'))
  assert.ok(propre('<div class="col-sm-12">a</div>').includes('<div class="col-md-12">a</div>'))
})

test('titre vide en tête de colonne : remplacé par un espace, sans titre vide', () => {
  const html = propre('<div class="row"><div class="col-md-4"><h2> </h2><ul><li>a</li></ul></div></div>')
  assert.ok(html.includes('<div class="titre-vide"></div>') && !html.includes('<h'))
})

test('guide écrit en commun : les équipes sont repérées, pas les personnes', () => {
  for (const nom of ['Nous joindre', 'Notre équipe', 'Bibliothèques UdeM', 'Bibliothécaires en droit', 'Équipe de référence', 'Équipe Papyrus', 'Soutien pour les thèses et les mémoires']) assert.ok(estCollectif(nom), nom)
  for (const nom of ['Christiane Melançon', 'Nancy Primeau', 'Marc-Olivier Croteau']) assert.ok(!estCollectif(nom), nom)
})

test('langue d\'un passage : gardée si elle n\'est pas le français', () => {
  assert.equal(propre('<p lang="en-CA">a <span lang="de">b</span> <span lang="fr-CA">c</span> <span lang="X-NONE">d</span></p>'), '<p lang="en-CA">a <span lang="de">b</span> c d</p>')
  assert.equal(propre('<p lang="FR">a</p>'), '<p>a</p>')
})

test('panneau d\'une boîte réutilisée : simple bloc', () => {
  assert.equal(propre('<div role="tabpanel" tabindex="0"><p>a</p></div>'), '<div><p>a</p></div>')
})

test('liens sans destination : texte gardé, « . » de visionneuse retiré, ancre conservée', () => {
  assert.equal(propre('<div aria-label="Image agrandie"><a href="#">.</a><p>t</p></div>'), '<div><p>t</p></div>')
  assert.equal(propre('<p><a href="#"><img src="https://x/a.png" alt="A"></a></p>'), '<p><img src="https://x/a.png" alt="A" loading="lazy"></p>')
  assert.ok(propre('<a name="y"></a>').includes('id="a1-y"'))
})

test('titre fait d\'une image : paragraphe sans texte de remplacement, titre sinon', () => {
  assert.ok(propre('<h3><img src="https://x/a.png"></h3>').startsWith('<p><img'))
  assert.ok(propre('<h3><img src="https://x/a.png" alt="A"></h3>').startsWith('<h4><img'))
})

test('image directement dans une liste : placée dans un élément', () => {
  assert.equal(propre('<ul><li>a</li><img src="https://x/a.png"></ul>'), '<ul><li>a</li><li><img src="https://x/a.png" alt="" loading="lazy"></li></ul>')
})

test('en-têtes de tableau : case vide en td, première rangée en gras en th, sinon rien', () => {
  const entete = propre('<table><tr><td></td><td><strong>A</strong></td><td><b><strong>B</strong></b> <b>C</b></td></tr><tr><td>1</td><td>2</td><td>3</td></tr></table>')
  assert.match(entete, /<tr><td><\/td><th scope="col"><strong>A<\/strong><\/th><th scope="col">/)
  assert.ok(propre('<table><thead><tr><th>&nbsp;</th><th>A</th></tr></thead><tr><td>1</td><td>2</td></tr></table>').includes('<td>&nbsp;</td><th scope="col">A</th>'))
  for (const source of ['<tr><td><b>A</b> suite</td><td><b>B</b></td></tr><tr><td>1</td><td>2</td></tr>', '<tr><td><b>A</b></td><td>B</td></tr><tr><td>1</td><td>2</td></tr>', '<tr><td><b>A</b></td><td><b>B</b></td></tr>', '<tr><td><b>A</b></td></tr><tr><td>1</td></tr>'])
    assert.ok(!propre(`<table>${source}</table>`).includes('<th'), source)
})

test('repères et clavier : tableaux numérotés sur la page, carrousel et code focalisables, iframe nommée par sa boîte', () => {
  const tableau = (legende = '') => `<table>${legende}<tr><td>a</td></tr></table>`
  const [section] = nettoyerGuide([{ id: '10', nom: 'A', boites: [{ id: '5', nom: 'B', contenus: [{ id: 1, html: tableau() + tableau('<caption>L</caption>') }, { id: 2, html: '<iframe src="https://www.youtube.com/embed/x"></iframe>' }] }, { id: '6', nom: '', contenus: [{ id: 3, html: tableau() }] }] }], ctx)
  assert.deepEqual(section.boites.flatMap((b) => b.html.match(/aria-label="[^"]+"/g)), ['aria-label="Tableau 1"', 'aria-label="Tableau 2 : L"', 'aria-label="Tableau 3"'])
  assert.ok(section.boites[0].html.includes('title="Contenu intégré : B"'))
  assert.ok(propre(carrouselDepuis('<div id="s-lib-cpane-1"><div><img src="https://x/a.jpg" alt="A"></div></div>', 'S')).includes('<ul class="carrousel-piste" tabindex="0">'))
  assert.equal(propre('<pre>x</pre>'), '<pre tabindex="0">x</pre>')
})

test('lien sans rien de visible retiré, lien-image et ancre gardés', () => {
  assert.equal(propre('<p>a <a href="https://x.org">​​</a><a href="https://y.org">b</a></p>'), '<p>a <a href="https://y.org/">b</a></p>')
  assert.ok(propre('<p><a href="https://x.org"><img src="https://x.org/i.png" alt="i"></a></p>').includes('href="https://x.org/"'))
  assert.ok(propre('<p><a id="ici" href="https://x.org">​</a>texte</p>').includes('id="'))
})

test('courriels d\'équipe : chaque adresse séparée, sans sujet', () => {
  assert.deepEqual(adressesDe('mailto:droit@bib.umontreal.ca?subject=x'), ['droit@bib.umontreal.ca'])
  assert.deepEqual(adressesDe('mailto:a@b.ca;c@d.ca'), ['a@b.ca', 'c@d.ca'])
})

test('tableau de bibliothécaires : vignettes, nom remis dans l\'ordre, personne absente gardée', () => {
  const source = '<div class="table-responsive"><table class="table"></table><table><thead><tr><th class="col-nom">Nom</th></tr></thead><tbody><tr><td class="name-cell"><div class="name-wrapper"><img src="https://x/a.jpg"> BOUHLAL, Sara</div></td><td>Bibliothécaire</td></tr><tr><td class="name-cell">X, Yann</td><td>Technicien</td></tr><tr><td></td></tr></tbody></table></div>'
  const appels: string[] = []
  const html = propre(equipeDepuis(source, (nom, photo, fonction) => {
    appels.push(nom)
    return nom === 'Sara BOUHLAL' ? { nom: 'Sara Bouhlal', photo: '/p.webp', href: 'https://bib.umontreal.ca/f?q=Sara', detail: 'Droit' } : { nom, photo, detail: fonction }
  }))
  assert.deepEqual(appels, ['Sara BOUHLAL', 'Yann X'])
  assert.equal(html.match(/<li class="vignette">/g)?.length, 2)
  assert.ok(html.includes('<a href="https://bib.umontreal.ca/f?q=Sara">Sara Bouhlal</a>') && html.includes('<p class="vignette-detail">Droit</p>'))
  assert.ok(html.includes('<p class="vignette-nom">Yann X</p>') && html.includes('Technicien') && !html.includes('<table'))
  assert.equal(equipeDepuis('<table><tr><td>a</td></tr></table>', () => { throw new Error('non') }), '<table><tr><td>a</td></tr></table>')
})
