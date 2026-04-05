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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
