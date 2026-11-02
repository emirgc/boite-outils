# La boîte à outils

Refonte statique de la [boîte à outils des Bibliothèques de l'UdeM](https://boite-outils.bib.umontreal.ca/), construite avec [Astro](https://astro.build).

Les auteurs continuent de rédiger dans LibGuides. Au build, le site lit ce contenu, le nettoie et le publie en fichiers statiques. Le jeton de l'API ne quitte jamais le build.

## Démarrer

Node 22.22

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

`src/lib/libguides.ts` combine deux sources :

- **L'API LibGuides** donne le catalogue, le contenu des guides et la liste A à Z.
- **Les pages publiques** (`c.php`) donnent le montage : quel contenu va dans quelle boîte, dans quel ordre, avec quels onglets.

L'API donne les morceaux, mais pas leur place. Ce montage ne se devine pas : les auteurs le décident guide par guide. Le site a donc besoin des pages publiques tant que l'API n'expose pas ce lien.

LibGuides bloque les rafales. Pour une vérification en lot, faites une requête par seconde et arrêtez au premier 429.

## Du contenu à la page

`src/lib/nettoyage.ts` applique les mêmes règles à tous les guides. **Corrigez une règle générale plutôt que de traiter un guide à la main** : le site en compte plus de 250.

Le nettoyage garde une liste de balises, d'attributs et de classes permis. Il retire les styles en ligne et les scripts, puis remplace par des classes ce qui compte : accordéons, encadrés, onglets, images à agrandir.

Les fiches des responsables viennent de la boîte de profil du guide, sinon de son propriétaire. `src/data/personnel.json` vient de bibweb et fournit la photo, la fonction et le lien du répertoire. Une personne absente de ce fichier garde son titre LibGuides, ou son nom seul sans boîte de profil.

## Le build

Le build incrémental d'Astro reprend du cache les pages dont le guide n'a pas changé : environ 6 s, contre 1 min pour un build complet.

- **Cache :** il est dans `node_modules/.astro` et doit être conservé entre deux builds. Supprimez ce dossier pour forcer une relecture complète.
- **Mise à jour :** [`mettre-a-jour.yml`](.github/workflows/mettre-a-jour.yml) demande à Amplify de reconstruire le site ([`amplify.yml`](amplify.yml)), ce qui prend en compte les guides modifiés et les fils RSS du jour. Ce workflow est inactif. Ses premières lignes indiquent comment l'activer.
- **Recherche :** `/index-recherche.json` est créé après le build à partir de `dist/`. `npm run dev` sert celui du dernier build.
- **Middleware :** il échappe à l'empreinte de code d'Astro. Toute nouvelle logique de `src/middleware.ts` doit entrer dans la clé de cache de `libguides.ts`.

**Indexation :** le site n'est indexable que sur la branche `production`. Partout ailleurs, chaque page porte `noindex`.

## Conventions

- **Accessibilité :** viser WCAG 2.2 AA, au clavier et sans JavaScript quand c'est possible.
- **Styles :** passer par les jetons de `src/styles/tokens.css`, sans couleur ni durée en dur.
- **Tests :** une nouvelle règle de nettoyage ou de recherche s'accompagne d'un test.

Le texte de remplacement des images, les en-têtes de tableaux et les autres corrections de rédaction se font dans LibGuides : aucune règle du code ne peut les remplacer.
