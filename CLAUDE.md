# CLAUDE.md – Agent Operating Manual for FactureCheck

## 🎯 Vision produit
SaaS no‑code de contrôle de conformité des factures électroniques françaises (factureCheck).  
Objectif : permettre aux freelances/TPE de vérifier en quelques secondes si une facture respecte les mentions obligatoires 2026‑2027.

## 📦 Stack technique
- Frontend : Next.js 14 (App Router), Tailwind CSS, Shadcn/ui
- Backend : Supabase (PostgreSQL, Auth, Storage)
- Paiements : Stripe (Checkout + portail client)
- Stockage fichiers : Supabase Bucket (PDF)
- OCR (MVP) : appel simple à un service externe (ex. : Azure Form Recognizer via webhook) – à remplacer plus tard par un modèle local si besoin.
- Tests : Vitest + Playwright (e2e)

## 🗂️ Organisation du travail
1. **Product Manager** : rédige les tickets PRD → `/tickets/*.md`
2. **System Architect** : définit la structure des dossiers, les schémas DB, les API routes.
3. **Frontend Engineer** : implémente les pages React/Tailwind.
4. **Backend Engineer** : écrit les fonctions Supabase (edge functions) et les routes API.
5. **QA Engineer** : crée les tests unitaires & e2e, vérifie la couverture.
6. **DevOps** : configure le déploiement Vercel + Supabase CI/CD.
7. **Security Analyst** : revue des dépendances, validation des variables d'environnement.

## 🔄 Processus itératif
- Chaque ticket est une issue GitHub avec une description claire (« As a user, I want to upload a PDF and see a conformity score »).
- Claude Code prend le ticket, écrit le code, ouvre un PR, puis attend une revue humaine (5‑10 min).
- Après validation, le PR est merged → le ticket passe à « Done ».
- Répéter jusqu'à ce que tous les tickets du MVP soient fermés.

## 📜 Conventions
- **Commit** : `feat: <ticket-id> – description courte` ou `fix: <ticket-id> – …`
- **Branches** : `feature/<ticket-id>`
- **Tests** : tout nouveau code doit être couvert par au moins un test unitaire ou e2e.
- **Review** : vérifier que le UI respecte les tokens Tailwind du design system (voir `design-test.html`).

## 🚀 Déploiement
- Vercel (preview sur chaque PR, production sur `main`).
- Supabase projets séparés : `dev` et `prod`.
- Stripe en mode test jusqu'au lancement public.
