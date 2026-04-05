@AGENTS.md

# Manuel opérationnel de l'agent FactureCheck

## Vision produit

SaaS no-code de contrôle de conformité des factures électroniques françaises.  
Objectif : permettre aux freelances et TPE de vérifier en quelques secondes si une facture respecte les mentions obligatoires 2026-2027.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Framework | Next.js 15 (App Router, Server Components, Server Actions) |
| Styles | Tailwind CSS v4 |
| Composants UI | Maison (CVA + `class-variance-authority`) — pas de Shadcn/ui |
| Base de données | Supabase PostgreSQL + RLS |
| Auth | Supabase Auth (email/mot de passe, `@supabase/ssr`) |
| Stockage fichiers | Supabase Storage (bucket `invoices`, privé) |
| OCR | `pdf-parse` (défaut) · Azure Form Recognizer (optionnel) |
| Tests | Vitest + @testing-library/react |
| Déploiement | Vercel |

---

## Structure du dépôt

```
facturecheck/
├── migrations/                  # Scripts SQL à exécuter dans l'ordre sur Supabase
│   ├── 001_waitlist.sql         # Table waitlist + RLS
│   ├── 002_uploads.sql          # Table uploads + RLS
│   ├── 003_storage.sql          # Politiques RLS bucket invoices
│   └── 004_ocr_fields.sql       # Colonnes OCR sur uploads
├── src/
│   ├── app/
│   │   ├── actions/
│   │   │   ├── upload.ts        # Server Action : upload PDF → Storage + DB + trigger OCR
│   │   │   ├── ocr.ts           # Server Actions : retryOcr, getUploadWithOcr
│   │   │   └── waitlist.ts      # Server Action : inscription liste d'attente
│   │   ├── api/
│   │   │   └── ocr/process/
│   │   │       └── route.ts     # Route interne OCR (Node.js runtime, protégée par secret)
│   │   ├── auth/
│   │   │   ├── callback/route.ts # Callback Supabase Auth (échange code → session)
│   │   │   └── login/page.tsx   # Page login/signup (Client Component)
│   │   ├── dashboard/
│   │   │   ├── layout.tsx       # Layout dashboard (protection côté serveur)
│   │   │   ├── page.tsx         # Dashboard principal (liste des uploads)
│   │   │   └── uploads/[id]/page.tsx  # Prévisualisation texte OCR d'un upload
│   │   ├── layout.tsx           # Layout racine
│   │   └── page.tsx             # Landing page publique
│   ├── components/
│   │   ├── EmailSignupForm.tsx  # Formulaire inscription waitlist (Client Component)
│   │   ├── LogoutButton.tsx     # Bouton déconnexion (Client Component)
│   │   ├── RetryOcrButton.tsx   # Bouton relancer OCR (Client Component, useTransition)
│   │   ├── UploadHistory.tsx    # Liste des uploads avec badges statut OCR
│   │   ├── UploadZone.tsx       # Zone drag-and-drop upload PDF
│   │   └── ui/
│   │       ├── button.tsx       # Composant Button (CVA, variants)
│   │       └── input.tsx        # Composant Input (CVA, variants)
│   ├── lib/
│   │   ├── api.ts               # Helpers fetch (triggerOcrAsync, delayMs)
│   │   ├── ocr/
│   │   │   ├── types.ts         # Interfaces OcrProvider, OcrResult
│   │   │   ├── index.ts         # getOcrProvider() — sélection du fournisseur
│   │   │   ├── mock-provider.ts # MockOcrProvider (tests et développement)
│   │   │   └── pdf-parse-provider.ts  # PdfParseProvider (production, Node.js)
│   │   ├── supabase.ts          # createSupabaseServerClient (service role)
│   │   ├── supabase-browser.ts  # createSupabaseBrowserClient (anon key)
│   │   ├── supabase-server.ts   # createSupabaseSessionClient (session cookie)
│   │   └── utils.ts             # cn() (clsx + tailwind-merge)
│   ├── middleware.ts             # Protection routes /dashboard, refresh session
│   └── test/setup.ts            # Configuration globale Vitest
├── .env.local.example
├── AGENTS.md                    # Règles spécifiques Next.js pour les agents
├── CLAUDE.md                    # Ce fichier — manuel opérationnel
└── README.md
```

---

## Variables d'environnement

Copier `.env.local.example` en `.env.local` :

| Variable | Portée | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Serveur | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Serveur | Clé anonyme Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **Serveur uniquement** | Clé service role — ne jamais exposer côté client |
| `NEXT_PUBLIC_APP_URL` | Client + Serveur | URL de base (`http://localhost:3000` en dev) |
| `INTERNAL_OCR_SECRET` | **Serveur uniquement** | Secret protégeant `/api/ocr/process` — générer avec `openssl rand -hex 32` |
| `AZURE_FORM_RECOGNIZER_ENDPOINT` | Serveur | Optionnel — active Azure Form Recognizer si défini |
| `AZURE_FORM_RECOGNIZER_KEY` | Serveur | Optionnel — obligatoire si l'endpoint Azure est défini |

---

## Base de données Supabase

Exécuter les migrations dans l'ordre dans **Dashboard → SQL Editor** :

```
migrations/001_waitlist.sql   → table waitlist
migrations/002_uploads.sql    → table uploads
migrations/003_storage.sql    → politiques RLS storage.objects
migrations/004_ocr_fields.sql → colonnes OCR sur uploads
```

### Schéma `uploads`

| Colonne | Type | Description |
|---|---|---|
| `id` | UUID PK | Identifiant |
| `user_id` | UUID FK → auth.users | Propriétaire |
| `file_name` | TEXT | Nom original du fichier |
| `storage_path` | TEXT | Chemin dans le bucket `invoices` |
| `mime_type` | TEXT | `application/pdf` |
| `file_size` | BIGINT | Taille en octets |
| `status` | TEXT | `uploaded` \| `processing` \| `done` \| `error` |
| `ocr_status` | TEXT | `pending` \| `processing` \| `processed` \| `failed` |
| `ocr_text` | TEXT | Texte extrait par l'OCR |
| `ocr_error` | TEXT | Message d'erreur si `ocr_status = 'failed'` |
| `ocr_processed_at` | TIMESTAMPTZ | Horodatage de fin de traitement |
| `ocr_provider` | TEXT | Nom du fournisseur OCR utilisé |
| `created_at` | TIMESTAMPTZ | Création de l'enregistrement |

---

## Bucket Supabase Storage

Créer manuellement le bucket `invoices` :

1. Dashboard → **Storage** → **New bucket**
2. Nom : `invoices`
3. **Décocher** "Public bucket" (privé obligatoire)
4. Appliquer `migrations/003_storage.sql`

Contraintes recommandées :
- Taille max : **10 485 760 octets** (10 Mo)
- Types MIME autorisés : `application/pdf`

---

## Pipeline OCR

### Architecture

```
uploadInvoice() [Server Action]
    │
    ├── Crée l'enregistrement (DB)   ocr_status = 'pending'
    └── triggerOcrAsync(uploadId)    fire-and-forget fetch()
                                            │
                               POST /api/ocr/process
                                            │
                               ┌────────────────────────────┐
                               │ Valide x-internal-secret   │
                               │ Récupère l'upload (DB)     │
                               │ Vérifie idempotence        │
                               │ SET ocr_status='processing' │
                               │ Télécharge PDF (Storage)   │
                               │ getOcrProvider()           │
                               │   └── extractText(buf)     │
                               │ SET ocr_status='processed'  │
                               │     ocr_text, ocr_provider  │
                               └────────────────────────────┘
```

### Fournisseurs OCR

| Fournisseur | Classe | Activation |
|---|---|---|
| `pdf-parse` | `PdfParseProvider` | Par défaut (aucune config) |
| Azure Form Recognizer | *(stub — à implémenter)* | Définir `AZURE_FORM_RECOGNIZER_ENDPOINT` + `AZURE_FORM_RECOGNIZER_KEY` |
| Mock | `MockOcrProvider` | Tests uniquement |

Pour ajouter un nouveau fournisseur :
1. Implémenter l'interface `OcrProvider` dans `src/lib/ocr/types.ts`
2. Ajouter la logique de sélection dans `src/lib/ocr/index.ts`
3. Documenter les variables dans `.env.local.example`

---

## Auth Supabase

Configuration requise dans **Dashboard → Authentication → URL Configuration** :

- **Site URL** : `http://localhost:3000` (dev) ou votre domaine (prod)
- **Redirect URLs** : `http://localhost:3000/auth/callback`

> En développement, désactiver la confirmation email dans  
> Dashboard → Authentication → Providers → Email → **"Confirm email" OFF**

---

## Conventions de développement

### Commits
```
feat: T001 – landing page et formulaire waitlist
fix: T002 – regex email rejette les doubles points
```

### Branches
```
feature/<ticket-id>   # ex. feature/T004
```

### Tests

- Tout code métier doit être couvert par au moins un test unitaire.
- Utiliser `vi.hoisted()` pour déclarer les mocks Vitest (évite les erreurs TDZ).
- Mocker `@/lib/supabase`, `@/lib/supabase-server` et `next/cache` dans chaque test serveur.

**Pattern obligatoire pour les mocks Vitest** :
```ts
const { mockGetUser, mockDbSingle } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockDbSingle: vi.fn(),
}));

vi.mock("@/lib/supabase-server", () => ({
  createSupabaseSessionClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}));
```

**Mock de la chaîne Supabase update** :
```ts
// Capturer les champs passés à .update() séparément du .eq() de filtrage
update: (fields: unknown) => {
  mockUpdateFn(fields);          // assertion sur les champs
  return { eq: mockUpdateEqResult }; // assertion sur le résultat
},
```

**Fire-and-forget OCR** (ne pas await intentionnellement) :
```ts
triggerOcrAsync(upload.id); // pas de await — invocation serverless distincte
```

**Double filtre owner** dans `getUploadWithOcr` :
```ts
.select("*").eq("id", uploadId).eq("user_id", userId).single()
```

---

## Lancer le projet en local

```bash
git clone https://github.com/webcreatjp-tech/facturecheck.git
cd facturecheck
npm install
cp .env.local.example .env.local
# Renseigner les valeurs dans .env.local
npm run dev          # http://localhost:3000
npm run test:run     # tous les tests (une seule exécution)
npm test             # tests en mode watch
```

---

## Processus de développement

1. Lire le ticket (description, critères d'acceptance, tests attendus).
2. Créer une branche `feature/<ticket-id>` depuis `main`.
3. Implémenter le code et les tests.
4. Vérifier que **tous les tests passent** (`npm run test:run`).
5. Committer avec message conventionnel.
6. Pousser et ouvrir une PR vers `main`.
7. Merger après validation.

---

## Tickets réalisés

| Ticket | Description | Branche |
|---|---|---|
| T001 | Landing page + formulaire waitlist | `feature/T001` |
| T002 | Connexion Supabase + enregistrement waitlist | `feature/T002` |
| T003 | Auth Supabase + upload PDF sécurisé | `feature/T003` |
| T004 | Pipeline OCR (pdf-parse + Azure stub) | `feature/T004` |
| T005 | Extraction structurée des champs de facture (regex) | `feature/T005` |

---

## Déploiement Vercel

Variables à configurer dans **Project → Settings → Environment Variables** :

- `NEXT_PUBLIC_*` : Production + Preview
- `SUPABASE_SERVICE_ROLE_KEY` et `INTERNAL_OCR_SECRET` : **Production uniquement**

> La route `/api/ocr/process` utilise le runtime Node.js (pas Edge).  
> Le fire-and-forget crée une invocation serverless distincte — comportement garanti sur Vercel.
