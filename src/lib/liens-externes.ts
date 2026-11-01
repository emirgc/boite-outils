/*
 * Tout lien absolu quitte le site : les liens vers les pages migrées ont déjà été
 * réécrits en chemins relatifs (reecrireLien). Il s'ouvre dans une autre fenêtre,
 * annoncée aux lecteurs d'écran, avec une flèche s'il contient du texte (guide.css).
 */
const LIEN = /<a\b((?:[^>"]|"[^"]*")*)>([\s\S]*?)<\/a>/g
const ANNONCE = '<span class="visuellement-masque"> (nouvelle fenêtre)</span>'

export function marquerLiensExternes(html: string) {
  return html.replace(LIEN, (lien, attributs: string, contenu: string) => {
    if (!/\shref="https?:/.test(attributs) || /\starget=/.test(attributs)) return lien
    const rel = /\srel=/.test(attributs) ? '' : ' rel="noopener"'
    const texte = contenu.replace(/<[^>]*>/g, '').trim() !== ''
    // Un lien sans nom reste signalé aux bibliothécaires par les audits : l'annonce ne doit pas lui en donner un
    const marque = texte ? `<span class="lien-externe">${ANNONCE}</span>` : /\salt="[^"]+"/.test(contenu) ? ANNONCE : ''
    return `<a${attributs} target="_blank"${rel}>${contenu}${marque}</a>`
  })
}
