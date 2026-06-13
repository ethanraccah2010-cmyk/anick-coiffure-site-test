# Anick Coiffure — Site vitrine

Site vitrine **100 % statique** (HTML / CSS / JS pur, **sans framework, sans build,
sans dépendance npm**) pour le salon **Anick Coiffure**, expert toutes textures à
Montgeron (91). Mobile-first, accessible, prêt à déployer sur **Vercel**.

> Vous pouvez ouvrir le site **en double-cliquant simplement `index.html`** :
> aucune installation n'est nécessaire pour le consulter en local.

---

## 📁 Structure du projet

```
.
├── index.html          → Accueil (hero, savoir-faire, prestations, avis, galerie, CTA)
├── prestations.html    → Carte des prestations + tarifs (ancres #soins #coupe #tresses #couleur)
├── galerie.html        → Galerie + lightbox (zoom au clic)
├── contact.html        → Coordonnées, horaires, carte Google Maps, formulaire de RDV (#rdv)
├── style.css           → Feuille de style unique (palette centralisée dans :root)
├── script.js           → Nav mobile, reveal au scroll, lightbox, formulaire, fallback images
├── vercel.json         → Config Vercel (cleanUrls, cache, en-têtes de sécurité)
├── robots.txt          → Indexation moteurs de recherche
├── sitemap.xml         → Plan du site (domaine : https://anickcoiffure.fr)
├── images/             → Vos photos (placeholders élégants tant qu'elles manquent)
└── README.md           → Ce fichier
```

---

## ✏️ Comment personnaliser

### 1. Changer les PRIX
Ouvrez **`prestations.html`**. Chaque prestation est un bloc :

```html
<div class="menu-item">
  <span class="menu-item__name">Nom de la prestation</span>
  <p class="menu-item__desc">Description courte</p>
  <span class="menu-item__price">à partir de 35 €</span>
</div>
```

Modifiez librement le **nom**, la **description** et le **prix**. Le bandeau
*« Tarifs indicatifs à confirmer avec le salon »* est en haut de page (cherchez
`class="notice"`) et se modifie comme un texte normal.

### 2. Changer les PHOTOS
Déposez vos images dans le dossier **`images/`** avec ces noms exacts :

| Fichier        | Usage                                   |
|----------------|-----------------------------------------|
| `hero.jpg`     | Grande photo d'accueil (portrait 4:5)   |
| `salon-1.jpg`  | Ambiance / Anick au travail (3:4)       |
| `salon-2.jpg`  | Détail coiffure (3:4)                    |
| `real-1.jpg` … `real-5.jpg` | Réalisations (galerie + accueil) |
| `og.jpg`       | Image de partage réseaux (1200×630)     |

> 💡 **Tant qu'une image manque, un placeholder doux s'affiche automatiquement**
> (aucune image cassée). Vous pouvez donc mettre le site en ligne avant d'avoir
> toutes les photos.

Pour **ajouter** une photo à la galerie, dupliquez un bloc dans `galerie.html` :

```html
<div class="g-cell" data-lb-item tabindex="0" role="button" aria-label="Agrandir la photo">
  <img src="images/ma-photo.jpg" data-fallback alt="Description de la photo" />
</div>
```

### 3. Changer les HORAIRES
Les horaires apparaissent à **3 endroits** (gardez-les cohérents) :
- le **footer** de chaque page (`class="footer__hours"`),
- la page **contact.html** (tableau `class="hours-table"`),
- le bloc **JSON-LD** dans `index.html` (`openingHoursSpecification`) — pour le SEO.

### 4. Changer le TÉLÉPHONE / l'ADRESSE
Cherchez et remplacez dans tous les fichiers :
- Téléphone affiché : `01 69 05 15 03`
- Lien d'appel : `tel:+33169051503`
- Adresse : `31 Avenue de la République` / `91230 Montgeron`

L'adresse du JSON-LD (`index.html`) et l'URL de la carte (`contact.html`) doivent
aussi être mises à jour si l'adresse change.

---

## 📅 Réservation connectée à Google Agenda

Le formulaire (page **contact.html**) crée **automatiquement** un événement dans
l'agenda Google du salon. Il affiche d'abord les créneaux réellement libres
(selon la durée de la prestation et les rendez-vous déjà pris), puis bloque le
créneau choisi. Architecture :

- **`/lib/config.js`** — source unique : table des prestations + **durées (min)**,
  horaires d'ouverture, fuseau `Europe/Paris`. ⚠ **À confirmer avec Anick** : une
  durée fausse peut provoquer une double-réservation.
- **`/lib/temps.js`** — conversions de fuseau (heure d'été/hiver gérée).
- **`/lib/creneaux.js`** — calcul des créneaux libres (logique pure).
- **`/lib/google.js`** — authentification OAuth + lecture/écriture de l'agenda.
- **`/api/disponibilites.js`** — `GET ?date=YYYY-MM-DD&prestation=CLE` → créneaux libres.
- **`/api/reserver.js`** — `POST` JSON → recalcule la durée côté serveur, revérifie
  la disponibilité, crée l'événement.

### 1. Identifiants Google (OAuth — pas de compte de service)
1. [console.cloud.google.com](https://console.cloud.google.com) → créez/choisissez un projet.
2. **APIs & Services → Library** → activez **Google Calendar API**.
3. **OAuth consent screen** → type *External*, renseignez les champs obligatoires,
   ajoutez votre adresse Google en **Test user**.
4. **Credentials → Create credentials → OAuth client ID** → type **Web application**.
   Dans *Authorized redirect URIs*, ajoutez `https://developers.google.com/oauthplayground`.
5. Notez le **Client ID** et le **Client secret**.

### 2. Refresh token via OAuth Playground
1. Ouvrez [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground).
2. Roue crantée (⚙, en haut à droite) → cochez **Use your own OAuth credentials**
   → collez Client ID + Client secret.
3. Étape 1 (scopes) : saisissez `https://www.googleapis.com/auth/calendar` →
   **Authorize APIs** → connectez-vous avec le compte de l'agenda du salon.
4. Étape 2 → **Exchange authorization code for tokens** → copiez le **Refresh token**.

### 3. Variables d'environnement sur Vercel
Dans **Project → Settings → Environment Variables**, ajoutez ces 4 variables pour
**Production ET Preview**, puis **Redeploy** :

| Variable                | Valeur                                             |
|-------------------------|----------------------------------------------------|
| `GOOGLE_CLIENT_ID`      | Client ID de l'étape 1                             |
| `GOOGLE_CLIENT_SECRET`  | Client secret de l'étape 1                         |
| `GOOGLE_REFRESH_TOKEN`  | Refresh token de l'étape 2                         |
| `GOOGLE_CALENDAR_ID`    | `primary` (ou l'ID d'un agenda dédié)             |

> Réglages projet : **Root Directory = racine**, **Framework Preset = Other**.
> Vercel installe `googleapis` (voir `package.json`) et détecte le dossier `/api`
> automatiquement. Le fichier `.env` local n'est **jamais** commité (`.gitignore`).

### 4. Tester
- API directe : `https://VOTRE-SITE/api/disponibilites?date=2026-06-20&prestation=coupe_femme`
  → doit renvoyer `{ "creneaux": ["09:00", …] }`.
- Formulaire : page **contact**, choisissez une prestation + une date, cliquez un
  créneau, validez → un événement apparaît dans l'agenda du salon.

> Anti-spam : honeypot `_gotcha` déjà en place. La prestation *« événementielle »*
> est **sur devis** : pas de réservation en ligne (renvoi vers le téléphone).

---

## 🚀 Déployer sur Vercel

### Méthode 1 — Glisser-déposer (la plus rapide)
1. Allez sur [vercel.com](https://vercel.com) → **Add New… → Project**.
2. Importez ce dossier (ou glissez-le) — **aucun build n'est nécessaire**.
3. Laissez les réglages par défaut (Framework Preset : **Other**) et déployez.

### Méthode 2 — Avec Git + CLI
```bash
npm i -g vercel     # une seule fois
vercel              # déploiement de prévisualisation
vercel --prod       # déploiement en production
```

Le fichier **`vercel.json`** active déjà :
- `cleanUrls` → URLs sans `.html` (`/prestations` au lieu de `/prestations.html`),
- `trailingSlash: false`,
- en-têtes de **cache** (CSS/JS/images) et de **sécurité**.

### Brancher le nom de domaine
Une fois `anickcoiffure.fr` acheté : dans Vercel → **Project → Settings → Domains**,
ajoutez le domaine et suivez les instructions DNS. Pensez ensuite à vérifier que
les URLs `https://anickcoiffure.fr/...` dans `sitemap.xml`, `robots.txt` et les
balises `canonical` / Open Graph correspondent bien à votre domaine définitif.

---

## ♿ Accessibilité & SEO

- `lang="fr"`, attributs `alt` descriptifs, `aria-label` sur les éléments interactifs.
- Navigation au clavier (lightbox, menu) et `:focus-visible` visible.
- Respect de `prefers-reduced-motion` (animations désactivées si demandé).
- `title` + meta description **uniques** par page, Open Graph, **JSON-LD HairSalon**
  (note 4,9/5 · 87 avis) sur l'accueil.

---

## 🎨 Personnaliser les couleurs / polices

Tout est centralisé en haut de **`style.css`** dans `:root` :

```css
--c-cream:  #FBF7F2;  /* fond principal */
--c-blush:  #F4E8E1;  /* surface secondaire */
--c-gold:   #C0894F;  /* accent principal */
--c-text:   #3A2E27;  /* texte */
--c-sage:   #9CA88F;  /* touche végétale */
```

Modifiez une valeur ici et elle se répercute sur tout le site.

---

© Anick Coiffure — 31 Avenue de la République, 91230 Montgeron · ☎ 01 69 05 15 03
