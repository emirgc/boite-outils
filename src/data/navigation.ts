/*
 * Liens du pied de page, repris de bibweb (src/data/navigation.ts) ; les
 * chemins internes du site des bibliothèques sont rendus absolus.
 */
import { BooksIcon } from '@phosphor-icons/react/dist/ssr/Books'
import { InfoIcon } from '@phosphor-icons/react/dist/ssr/Info'
import { InstagramLogoIcon } from '@phosphor-icons/react/dist/ssr/InstagramLogo'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react/dist/ssr/PaperPlaneTilt'
import { UserIcon } from '@phosphor-icons/react/dist/ssr/User'
import { YoutubeLogoIcon } from '@phosphor-icons/react/dist/ssr/YoutubeLogo'

const BIB = 'https://bib.umontreal.ca'

interface LienPied {
  libelle: string
  href: string
  rel?: string
  Icone?: typeof InfoIcon
  point?: string
  fonction?: string
}

export const COLONNES_PIED: { titre: string; liens: LienPied[] }[] = [
  {
    titre: "Besoin d'aide?",
    liens: [
      { libelle: 'Nous joindre', href: `${BIB}/nous-joindre/`, Icone: PaperPlaneTiltIcon },
      { libelle: 'Mon dossier', href: 'https://umontreal.account.worldcat.org/account', rel: 'noopener noreferrer', Icone: UserIcon },
      { libelle: 'À propos', href: `${BIB}/a-propos/`, Icone: InfoIcon },
    ],
  },
  {
    titre: 'Sites connexes',
    liens: [
      { libelle: 'Site des bibliothèques', fonction: 'Espaces, services et ressources', href: 'https://bib.umontreal.ca/', point: 'var(--bleu-principal)' },
      { libelle: 'Boîte à outils', fonction: 'Guides pour vos recherches', href: '/', point: 'var(--rouge-orange)' },
      { libelle: 'Studio·bib', fonction: 'Informatique et création numérique', href: 'https://studio.bib.umontreal.ca/', point: 'var(--jaune)' },
      { libelle: 'Papyrus', fonction: 'Dépôt institutionnel', href: 'https://umontreal.scholaris.ca/', point: 'var(--vert-fonce)' },
      { libelle: 'GéoIndex', fonction: 'Données géospatiales', href: 'https://geoapp.bibl.ulaval.ca/', rel: 'noopener noreferrer', point: 'var(--bleu-200)' },
      { libelle: 'Collections spéciales', fonction: 'Objets numériques', href: 'https://collections-speciales.bib.umontreal.ca/', point: 'var(--rose-300)' },
    ],
  },
]

export const RESEAUX_PIED = [
  { libelle: 'YouTube des Bibliothèques', href: 'https://www.youtube.com/user/BibliothequesUdeM', Icone: YoutubeLogoIcon },
  { libelle: "Instagram de l'Université de Montréal", href: 'https://www.instagram.com/umontreal/', Icone: InstagramLogoIcon },
]

export const URGENCE = { libelle: 'Urgence UdeM 514\u00a0343\u20117771', href: 'tel:+15143437771' }

export const LIENS_QUEUE_PIED = [
  { libelle: 'Confidentialité', href: 'https://vie-privee.umontreal.ca/confidentialite/' },
  { libelle: "Conditions d'utilisation", href: `${BIB}/conditions-utilisation/` },
  { libelle: 'Accessibilité', href: `${BIB}/accessibilite-web/` },
]

/** Fiche « Nous joindre » des guides écrits en commun */
export const LIENS_NOUS_JOINDRE = [
  { libelle: 'Joindre votre bibliothécaire', href: `${BIB}/nous-joindre/notre-equipe/` },
  { libelle: 'Clavarder', href: `${BIB}/nous-joindre/clavarder/` },
]

/** Remplacé par le courriel de l'équipe quand la fiche LibGuides en donne un */
export const LIEN_NOUS_ECRIRE = `${BIB}/nous-joindre/nous-ecrire/`

/** À côté de la recherche, comme dans le menu de bibweb */
export const LIENS_SOFIA = [
  { libelle: 'Mon dossier', href: 'https://umontreal.account.worldcat.org/account', Icone: UserIcon },
  { libelle: 'Obtenir un document', href: `${BIB}/obtenir/`, Icone: BooksIcon },
]
