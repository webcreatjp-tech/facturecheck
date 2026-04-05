This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Variables d'environnement

Copiez `.env.local.example` en `.env.local` et renseignez les trois variables :

| Variable | Portée | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Serveur | URL du projet Supabase (Dashboard → Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Serveur | Clé anonyme Supabase (publique, sans danger) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Serveur uniquement** | Clé service role — **ne jamais exposer côté client** |
| `NEXT_PUBLIC_APP_URL` | Client + Serveur | URL de base de l'app (`http://localhost:3000` en dev) |

```bash
cp .env.local.example .env.local
# Éditez .env.local avec les valeurs de votre projet Supabase
```

> **Déploiement Vercel** : ajoutez ces variables dans *Project → Settings → Environment Variables*.  
> Sélectionnez "Production" et "Preview" pour `NEXT_PUBLIC_*`, mais **uniquement "Production"** pour `SUPABASE_SERVICE_ROLE_KEY`.

### Migrations base de données

Exécutez les scripts SQL dans l'ordre dans l'éditeur SQL Supabase (Dashboard → SQL Editor) :

| Fichier | Contenu |
|---|---|
| `migrations/001_waitlist.sql` | Table `waitlist` + RLS |
| `migrations/002_uploads.sql` | Table `uploads` + RLS (référence `auth.users`) |
| `migrations/003_storage.sql` | Politiques RLS sur `storage.objects` |
| `migrations/004_ocr_fields.sql` | Colonnes OCR sur `uploads` (ocr_status, ocr_text, etc.) |

### Bucket Supabase Storage (T003)

Avant d'utiliser l'upload de factures, créez le bucket `invoices` manuellement :

1. Dashboard Supabase → **Storage** → **New bucket**
2. Nom : `invoices`
3. **Décocher** "Public bucket" (bucket privé obligatoire)
4. Appliquer les politiques dans `migrations/003_storage.sql`

Constraints du bucket recommandées (via l'API ou config) :
- Taille maximale : **10 485 760 octets** (10 Mo)
- Types MIME autorisés : `application/pdf`

### Supabase Auth (T003)

Le tableau de bord `/dashboard` est protégé par Supabase Auth (email + mot de passe).  
Configuration requise dans Dashboard Supabase → **Authentication → URL Configuration** :

- **Site URL** : `http://localhost:3000` (dev) ou votre domaine (prod)
- **Redirect URLs** : ajouter `http://localhost:3000/auth/callback`

> En développement, vous pouvez désactiver la confirmation email dans  
> Dashboard → Authentication → Providers → Email → **"Confirm email" OFF**  
> pour simplifier les tests.

### Pipeline OCR (T004)

#### Variables d'environnement

| Variable | Obligatoire | Description |
|---|---|---|
| `INTERNAL_OCR_SECRET` | **Oui** | Secret protégeant la route `/api/ocr/process`. Générer avec `openssl rand -hex 32` |
| `AZURE_FORM_RECOGNIZER_ENDPOINT` | Non | Endpoint Azure Form Recognizer (PDFs scannés) |
| `AZURE_FORM_RECOGNIZER_KEY` | Non | Clé Azure Form Recognizer |

#### Fournisseurs OCR disponibles

| Fournisseur | Activation | PDFs texte | PDFs scannés |
|---|---|---|---|
| `pdf-parse` (défaut) | Aucune config requise | ✓ | ✗ |
| Azure Form Recognizer | Définir les 2 vars Azure | ✓ | ✓ |

#### Architecture du pipeline

```
uploadInvoice()          /api/ocr/process
     │                         │
     ├─ Crée upload (DB)        ├─ Valide secret interne
     │  ocr_status='pending'    ├─ Télécharge PDF (Storage)
     │                         ├─ OCR via getOcrProvider()
     └─ fetch() fire-and-forget └─ Met à jour ocr_status + ocr_text
```

> **Note Vercel** : le fire-and-forget `fetch()` crée une invocation serverless distincte.  
> Sur d'autres hébergeurs (Railway, Fly.io), ce comportement peut varier selon la durée maximale des requêtes.

#### Ajouter un nouveau fournisseur OCR

1. Implémenter l'interface `OcrProvider` (voir `src/lib/ocr/types.ts`)
2. Ajouter la logique de sélection dans `src/lib/ocr/index.ts` (fonction `getOcrProvider`)
3. Ajouter les variables d'environnement nécessaires dans `.env.local.example`

### Extraction structurée (T005)

#### Variables d'environnement

Aucune variable supplémentaire requise. Le pipeline d'extraction réutilise `INTERNAL_OCR_SECRET` pour protéger la route interne `/api/extraction/process`.

#### Fournisseurs d'extraction disponibles

| Fournisseur | Classe | Activation |
|---|---|---|
| `regex` (défaut) | `RegexExtractionProvider` | Aucune config requise |
| Mock | `MockExtractionProvider` | Tests uniquement |

#### Architecture du pipeline

```
/api/ocr/process              /api/extraction/process
        │                               │
        ├─ OCR réussi                   ├─ Valide secret interne
        └─ fetch() fire-and-forget      ├─ Vérifie ocr_status = 'processed'
                                        ├─ Vérifie idempotence
                                        ├─ SET extraction_status='processing'
                                        ├─ getExtractionProvider().extractFields(ocr_text)
                                        └─ SET extraction_status='extracted' + extracted_fields (JSONB)
```

#### Ajouter un nouveau fournisseur d'extraction

1. Implémenter l'interface `ExtractionProvider` (voir `src/lib/extraction/types.ts`)
2. Ajouter la logique de sélection dans `src/lib/extraction/index.ts` (fonction `getExtractionProvider`)

### Moteur de conformité (T006)

#### Variables d'environnement

Aucune variable supplémentaire requise. Le pipeline de conformité réutilise `INTERNAL_OCR_SECRET` pour protéger la route interne `/api/compliance/check`.

#### Version des règles

La constante `RULES_VERSION` dans `src/lib/compliance/index.ts` identifie le jeu de règles actif.  
Incrémenter cette valeur à chaque modification des règles ou de leurs poids.

#### Règles implémentées

| Catégorie | Nombre | Impact score |
|---|---|---|
| Erreurs bloquantes | 13 | −11 à −12 pts chacune |
| Avertissements | 6 | −2 à −5 pts chacun |
| Suggestions | 4 | 0 pt (bonnes pratiques) |

**Bandes de score :**

| Score | Bande | Couleur |
|---|---|---|
| 90-100 | Conforme | Vert |
| 70-89 | Attention requise | Jaune |
| 50-69 | Non conforme — corrections nécessaires | Orange |
| 0-49 | Non conforme — facture invalide | Rouge |

> Une seule erreur bloquante entraîne un score ≤ 89 (hors bande "Conforme").

#### Architecture du pipeline

```
/api/extraction/process       /api/compliance/check
        │                               │
        ├─ Extraction réussie           ├─ Valide secret interne
        └─ fetch() fire-and-forget      ├─ Vérifie extraction_status = 'extracted'
                                        ├─ Vérifie idempotence
                                        ├─ SET compliance_status='processing'
                                        ├─ checkCompliance(extracted_fields)  ← pur, déterministe
                                        ├─ UPSERT compliance_results
                                        └─ SET compliance_status='checked' + score + band
```

#### Ajouter une nouvelle règle

1. Créer une fonction `ruleXxx(fields): RuleResult` dans `src/lib/compliance/rules.ts`
2. L'ajouter au tableau `ALL_RULES` dans le même fichier
3. Incrémenter `RULES_VERSION` dans `src/lib/compliance/index.ts`
4. Écrire un test unitaire dans `src/lib/compliance/rules.test.ts`

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
