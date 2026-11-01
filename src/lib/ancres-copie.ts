/*
 * Copie de l'adresse d'une section au clic sur le lien d'ancre d'un titre
 * (.ancre-titre, voir ancres.ts). La confirmation est double : une bulle
 * « Lien copié » près de l'icône (CSS, attribut data-copie) et une région
 * d'annonce pour les lecteurs d'écran, la bulle étant ignorée par ceux-ci.
 */
const DUREE_MS = 2000

export function copierLienAncre() {
  // Région présente dès le chargement : une région créée au moment de
  // l'annonce n'est pas toujours lue.
  const annonce = document.createElement('p')
  annonce.setAttribute('role', 'status')
  annonce.className = 'visuellement-masque'
  document.body.append(annonce)

  let minuterie: ReturnType<typeof setTimeout> | undefined

  document.addEventListener('click', (e) => {
    // Ctrl/Cmd-clic, clic milieu… : on laisse le navigateur faire
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    const lien = (e.target as Element).closest<HTMLAnchorElement>('a.ancre-titre')
    if (!lien || !navigator.clipboard) return

    navigator.clipboard.writeText(lien.href).then(
      () => {
        clearTimeout(minuterie)
        for (const autre of document.querySelectorAll('.ancre-titre[data-copie]')) autre.removeAttribute('data-copie')
        lien.setAttribute('data-copie', '')
        // Vider puis remplir : un second « Lien copié » identique est relu
        annonce.textContent = ''
        requestAnimationFrame(() => (annonce.textContent = 'Lien de la section copié'))
        minuterie = setTimeout(() => {
          lien.removeAttribute('data-copie')
          annonce.textContent = ''
        }, DUREE_MS)
      },
      // Presse-papier refusé : la navigation vers l'ancre suffit
      () => {},
    )
  })
}
