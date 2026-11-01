# La boîte à outils

Refonte statique de la [boîte à outils des Bibliothèques de l'UdeM](https://boite-outils.bib.umontreal.ca/), construite avec [Astro](https://astro.build).

Les bibliothécaires continuent de rédiger dans LibGuides. Au build, le site lit ce contenu, le nettoie et le publie. Il n'y a ni serveur ni base de données en production : seulement des fichiers statiques. Le jeton de l'API ne quitte jamais le build.

Le site produit environ 1 630 pages :

| Adresse | Contenu | Fichier |
| --- | --- | --- |
| `/` | Accueil (le guide « La boîte à outils ») | `src/pages/index.astro` |
| `/citer/`, `/droit/`… | Les 16 portails | `src/pages/[portail]/index.astro` |
| `/citer/chicago/`… | Chaque page de chaque guide | `src/pages/[...page].astro` |
| `/bases-de-donnees/` | Bases de données de A à Z | `src/pages/bases-de-donnees/index.astro` |
| `/resultats/` | Résultats de recherche | `src/pages/resultats.astro` |
| `/404.html` | Page non trouvée | `src/pages/404.astro` |
| `/guides.json` | Liste lue par le champ de recherche | `src/pages/guides.json.ts` |
| `/index-recherche.json` | Index de la page de résultats | `src/integrations/index-recherche.mjs` |

## Démarrer

Il faut Node 22.22 ou plus récent et un accès réseau, car même le serveur de développement lit LibGuides.

```sh
npm install
cp .env.example .env   # puis remplir LIBGUIDES_CLIENT_ID et LIBGUIDES_CLIENT_SECRET
npm run dev            # développement
npm run build          # génère dist/
npm run preview        # sert dist/ en local
npm test               # tests unitaires
```

Ne versionnez jamais le fichier `.env`.

## D'où vient le contenu

Le code qui lit LibGuides est dans `src/lib/libguides.ts`. Il combine deux sources, parce qu'aucune ne suffit seule.

**L'API LibGuides** (`https://lgapi-ca.libapps.com/1.2`), authentifiée par OAuth (`client_credentials`) :

| Appel | Sert à obtenir |
| --- | --- |
| `POST oauth/token` | Le jeton, un seul pour tout le build ; un 401 en redemande un, une fois |
| `GET guides?status=1&expand=pages,owner` | Le catalogue : guides, pages, adresses, dates de mise à jour |
| `GET assets?guide_ids=<id>` | Le contenu d'un guide |
| `GET az?expand=az_types,az_props,subjects,friendly_url,icons` | La liste A à Z |

**Les pages publiques** (`c.php?g=<guide>&p=<page>`), une par page de guide. `expand=pages.boxes` donne les boîtes et leur position, mais l'API ne relie pas un contenu à sa boîte : seule la page publique donne l'ordre des contenus, les titres affichés, les onglets, les carrousels, les fiches de personnel et les contenus réutilisés d'un autre guide. Le site ne peut donc pas se passer de cette source tant que l'API n'expose pas ce lien.

**Autres lectures :** les widgets de listes de guides, les fils RSS et Atom intégrés aux guides. Un fil en panne n'arrête pas le build : un avertissement s'affiche et la page affiche un simple lien vers le fil.

Toutes ces requêtes passent par `appelLimite` : 6 au maximum en même temps, 3 essais en cas d'erreur 429 ou 5xx.

### Points à connaître sur la liste A à Z

- `expand=az_props` est obligatoire : sans lui, l'API ne renvoie ni `enable_new` ni `enable_trial`.
- La réponse contient des **notes internes** (`internal_note`). `lireBases` ne recopie que les champs publiés ; n'ajoutez jamais la réponse brute à une page.
- Les bases `enable_hidden` sont retirées.
- Le lien d'une base est `friendly_url` plutôt que `url`, car l'adresse courte passe par le proxy de l'UdeM au besoin.
- `subjects[].featured` indique les bases recommandées pour un sujet (0 = non, sinon le rang).

## Du contenu LibGuides à la page

`src/lib/nettoyage.ts` applique les mêmes règles à **tous** les guides. Corrigez une règle générale plutôt que de traiter un guide à la main : le site en compte plus de 250.

- **Assainissement :** une liste de balises, d'attributs et de classes permis ; les styles en ligne et les scripts disparaissent, sauf les quiz LibWizard. Les iframes ne viennent que de sources connues, les autres deviennent des liens.
- **Structure :** accordéons changés en `<details>`, niveaux de titres sans saut, ancres sur les titres, encadrés gris changés en `.alerte` (⚠️) ou `.encadre`. Un exemple ou une annonce (⚙, 🌟, « Exemple ») reste un encadré normal.
- **Liens :** les liens vers des pages migrées deviennent relatifs. `az.php` mène à `/bases-de-donnees/` en gardant ses filtres (`q`, `s`, `t`, `v`, `a`).
- **Accessibilité :** `lang` conservé pour les passages qui ne sont pas en français, en-têtes de tableau déduits d'une première rangée en gras, tableaux nommés et focalisables.

**Liens externes :** `src/middleware.ts` traite le HTML de chaque page rendue. Tout lien absolu encore présent quitte le site, puisque les liens migrés sont déjà relatifs : il s'ouvre dans une autre fenêtre, annoncée aux lecteurs d'écran, avec une flèche s'il contient du texte (`src/lib/liens-externes.ts`).

**Personnel :** `src/data/personnel.json` et `public/images/personnel/` viennent de bibweb et fournissent le nom, la photo et le lien du répertoire.

## Le build

Le build incrémental d'Astro (`experimental.incrementalBuild`) évite de tout relire et de tout regénérer.

```
1. Lire le catalogue
2. Pour chaque page de guide, calculer son cacheKey :
   date « updated » du guide | empreinte du catalogue | numéro de semaine
3. Clé et code de la route identiques au build précédent ?
   oui → reprendre le HTML du cache, sans aucune requête
   non → charger le guide et rendre ses pages
4. Rendre l'accueil, les portails, /bases-de-donnees/, /resultats/ et /guides.json, qui n'ont pas de clé
5. Écrire /index-recherche.json à partir du HTML de dist/
```

Le chargement d'un guide se trouve dans le corps de la page : une page reprise du cache n'interroge donc pas LibGuides.

| Situation | Temps de `astro build` | Requêtes |
| --- | --- | --- |
| Tout est à regénérer | Environ 1 min | Environ 1 950 |
| Rien n'a changé | Environ 6 s | Environ 70 (mesure faite avant l'ajout de la page A à Z) |

### Ce qui déclenche un nouveau rendu

| Changement | Pages regénérées |
| --- | --- |
| Guide modifié dans LibGuides | Ses pages, plus celles qui n'ont pas de clé |
| Guide ajouté, renommé, déplacé, page ajoutée | Tout le site : liens et fils d'Ariane en dépendent |
| Code d'une page ou de ce qu'elle importe (CSS, `nettoyage.ts`, `personnel.json`) | Toutes les pages de cette route |
| Résultat de `marquerLiensExternes` | Toutes les pages de guides, grâce à l'empreinte du catalogue |
| Changement de semaine (jeudi 00 h UTC) | Toutes les pages de guides, pour rafraîchir fils et widgets |
| Configuration ou fichier de verrouillage des dépendances | Tout le site |

### Limites

- **Le cache est dans `node_modules/.astro`** (environ 105 Mo). Si l'hébergeur ne conserve pas ce dossier entre deux builds, chaque déploiement est complet.
- **Forcer une relecture complète :** supprimez `node_modules/.astro`.
- **Le middleware échappe à l'empreinte de code d'Astro.** La clé couvre le résultat de `marquerLiensExternes` sur un exemple ; toute nouvelle logique de `src/middleware.ts` doit être couverte aussi, sinon les pages en cache ne changent pas.
- **Contenu réutilisé :** le site suppose que `updated` change quand un contenu réutilisé d'un autre guide est modifié. Si ce n'est pas le cas, le changement apparaît au prochain changement de semaine.
- **Fils RSS :** une page peut afficher un fil vieux d'au plus une semaine.
- **Option expérimentale :** elle peut changer à une mise à jour d'Astro. Pour s'en passer, retirez-la de `astro.config.mjs` : les `cacheKey` seront simplement ignorés.

## Page des bases de données

Sans JavaScript, la liste complète et les ancres de l'alphabet restent utilisables. Avec JavaScript :

- **Recherche :** elle vise le début des mots du titre, de la description, des autres noms et du fournisseur. Les résultats forment une liste plate : titre qui commence par la recherche, puis titre qui contient tous les mots, puis le reste.
- **Filtres :** sujet, type et fournisseur portent les mêmes noms que sur `az.php` et suivent l'adresse. Le nombre de chaque choix tient compte des autres filtres, et un choix sans résultat disparaît.
- **Alphabet :** il reste visible au défilement sur grand écran. Cliquer une lettre efface la recherche et ramène au début des résultats s'ils sont hors de vue ; saisir une recherche retire la lettre, pour ne pas cacher de résultats.
- **Recommandées :** un sujet choisi fait remonter ses bases `featured`.

La logique sans DOM est dans `src/lib/recherche-guides.ts` et testée ; le script de la page ne fait que l'appliquer.

## Recherche du site

`src/components/RechercheGuides.astro` suit le motif « combobox » de l'APG. La liste `/guides.json` (titres des guides et des bases) n'est chargée qu'au premier focus. Chaque suggestion indique sa source, comme dans bibweb : « Guide → Droit ».

Sans suggestion choisie, le formulaire et « Tous les résultats » mènent à `/resultats/?q=…` (`src/pages/resultats.astro`). La page cherche dans le contenu des guides et les fiches des bases, filtre par source et propose la même recherche dans Sofia. Le titre compte d'abord : début du titre, tous les mots dans le titre, nom de la page, puis contenu. Comme sur la page A à Z, un mot cherché doit commencer un mot du texte. Elle demande JavaScript. La page n'est pas indexée par les moteurs de recherche.

L'index `/index-recherche.json` vient de `src/integrations/index-recherche.mjs`. Une fois le build terminé, ce module lit le HTML de `dist/` : il n'interroge pas LibGuides et voit aussi les pages reprises du cache. Il n'existe donc pas avec `npm run dev`, où la page ne cherche que dans les titres.

## Témoins et statistiques

`src/components/coquille/Consentement.astro` et `src/lib/consentement.ts` viennent de bibweb. Le choix est gardé dans le témoin `bib-consentement`, partagé sur `bib.umontreal.ca` et ses sous-domaines. Google Tag Manager et Clarity, avec les mêmes identifiants que bibweb, ne se chargent qu'après un accord valide ; « Paramètres des témoins », dans le pied de page, rouvre le panneau.

Ce panneau ne commande pas les contenus intégrés aux guides. Les vidéos YouTube, Panopto ou Vimeo se chargent à l'affichage de la page : la phrase de bibweb sur le chargement de YouTube au clic n'est donc pas reprise ici.

## Référencement

**Le site n'est indexable qu'en production.** `astro.config.mjs` déduit `SITE_ENV` de la branche git : `production` donne `production`, toute autre donne `preprod`. La variable peut être forcée au build. Hors production, chaque page porte `noindex` et `robots.txt` interdit tout : l'ancien site reste la référence tant qu'il est en ligne. `SITE_ENV` entre dans la clé de cache, donc changer d'environnement regénère les pages.

Chaque page indexable reçoit une adresse canonique, des balises Open Graph et un fil d'Ariane en `BreadcrumbList`. `/resultats/` et la page 404 restent en `noindex`.

- **Description :** la première page d'un guide reprend sa description si elle fait au moins 50 caractères. Les autres pages reprennent le début de leur texte, sans les titres (`src/lib/extrait.ts`).
- **Sitemap :** `src/integrations/sitemap.mjs` écrit `/sitemap.xml` à partir de `dist/`, ce qui couvre les pages reprises du cache.
- **Adresse du site :** `site` dans `astro.config.mjs` sert aux adresses canoniques et au sitemap. Les aperçus restent en `noindex`.
- **Anciennes adresses :** les guides gardent leur chemin, mais les pages internes de LibGuides sont en `c.php?g=…&p=…`. Un site statique ne peut pas lire ces paramètres : il faudra des redirections chez l'hébergeur à la bascule.

## Arborescence

```
src/
  components/    Recherche, fiche de base, coquille (pied de page, fil d'Ariane, retour en haut, rétroaction)
  data/          Navigation et personnel
  integrations/  Index de recherche, écrit après le build
  layouts/       Base.astro : en-tête, menu, rideau, pied de page
  lib/           libguides (lecture), nettoyage, liens-externes, recherche-guides, consentement, animations
  middleware.ts  Marque les liens externes
  pages/         Les routes (voir le tableau du début)
  styles/        tokens.css (jetons), global.css, guide.css, animations.css
```

## Conventions

- **Accessibilité :** viser WCAG 2.2 AA. Tout doit rester utilisable au clavier et sans JavaScript quand c'est possible.
- **Styles :** les composants passent par les jetons de `tokens.css`, sans couleur ni durée en dur.
- **Tests :** `npm test` lance les tests de `src/`. Une nouvelle règle de nettoyage ou de recherche s'accompagne d'un test.

## Ce qui reste à faire dans LibGuides

Ces points demandent une rédaction humaine, donc aucune règle du code ne peut les corriger :

- texte de remplacement des images, surtout les liens-images (133 liens sur 71 pages) et les captures de tutoriels ;
- en-têtes des tableaux dont la première rangée n'est pas en gras ;
- `lang` sur les passages et les guides en anglais ;
- ancres vers un identifiant absent, titres de page en double, liens `href="#"` ;
- fil RSS en panne : `medicalxpress.com` répond 404.
