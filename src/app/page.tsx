import { CheckCircle, FileText, Zap } from "lucide-react";
import EmailSignupForm from "@/components/EmailSignupForm";

const FEATURES = [
  {
    icon: Zap,
    title: "Analyse en quelques secondes",
    description:
      "Déposez votre PDF et obtenez un rapport de conformité instantané.",
  },
  {
    icon: CheckCircle,
    title: "Mentions 2026-2027 couvertes",
    description:
      "Tous les champs obligatoires de la réforme française vérifiés automatiquement.",
  },
  {
    icon: FileText,
    title: "Sans code, sans formation",
    description:
      "Interface intuitive conçue pour les freelances et les petites structures.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "J'ai évité un redressement fiscal grâce à FactureCheck. Indispensable !",
    author: "Marie D.",
    role: "Consultante indépendante",
  },
  {
    quote:
      "En 30 secondes je sais si ma facture est conforme. Un gain de temps énorme.",
    author: "Thomas R.",
    role: "Développeur freelance",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ── Nav ── */}
      <header className="border-b border-gray-100 sticky top-0 z-50 bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-bold text-blue-600 tracking-tight">
            FactureCheck
          </span>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
            <a
              href="#fonctionnalites"
              className="hover:text-blue-600 transition-colors"
            >
              Fonctionnalités
            </a>
            <a
              href="#temoignages"
              className="hover:text-blue-600 transition-colors"
            >
              Témoignages
            </a>
            <a
              href="#signup"
              className="rounded-xl bg-blue-600 text-white px-5 py-2 font-semibold hover:bg-blue-700 transition-colors"
            >
              Essai gratuit
            </a>
          </nav>
          {/* Mobile CTA */}
          <a
            href="#signup"
            className="sm:hidden rounded-xl bg-blue-600 text-white px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Essai gratuit
          </a>
        </div>
      </header>

      <main className="flex-1">
        {/* ── Hero ── */}
        <section className="py-20 sm:py-32 px-4 sm:px-6 text-center bg-gradient-to-b from-blue-50 to-white">
          <div className="mx-auto max-w-3xl">
            <span className="inline-block rounded-full bg-blue-100 text-blue-700 text-xs font-semibold px-4 py-1.5 mb-6 tracking-wide uppercase">
              Réforme facturation 2026–2027
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900 leading-tight">
              Votre facture est-elle{" "}
              <span className="text-blue-600">vraiment conforme</span>&nbsp;?
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              FactureCheck analyse votre PDF en quelques secondes et détecte
              toutes les mentions obligatoires manquantes — avant que le fisc ne
              le fasse.
            </p>

            {/* ── Email signup ── */}
            <div id="signup" className="mt-10 scroll-mt-24">
              <EmailSignupForm />
              <p className="mt-3 text-xs text-gray-400">
                Gratuit, sans carte bancaire. Accès anticipé limité.
              </p>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section
          id="fonctionnalites"
          className="py-20 px-4 sm:px-6 scroll-mt-20"
        >
          <div className="mx-auto max-w-6xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-12">
              Pourquoi FactureCheck&nbsp;?
            </h2>
            <div className="grid sm:grid-cols-3 gap-8">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="flex flex-col items-start gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="rounded-xl bg-blue-50 p-3">
                    <Icon className="h-6 w-6 text-blue-600" aria-hidden />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Social proof ── */}
        <section
          id="temoignages"
          className="py-20 px-4 sm:px-6 bg-gray-50 scroll-mt-20"
        >
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 mb-12">
              Ils nous font confiance
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {TESTIMONIALS.map(({ quote, author, role }) => (
                <figure
                  key={author}
                  className="rounded-2xl bg-white border border-gray-100 shadow-sm p-6"
                >
                  <blockquote className="text-gray-700 italic leading-relaxed">
                    &ldquo;{quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-4">
                    <span className="font-semibold text-gray-900 text-sm">
                      {author}
                    </span>
                    <span className="text-gray-400 text-sm"> · {role}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="py-20 px-4 sm:px-6 text-center">
          <div className="mx-auto max-w-xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">
              Prêt à sécuriser vos factures&nbsp;?
            </h2>
            <p className="text-gray-600 mb-8">
              Rejoignez les freelances et TPE qui vérifient leurs factures avant
              de les envoyer.
            </p>
            <EmailSignupForm />
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-100 py-8 px-4 sm:px-6 text-center text-xs text-gray-400">
        <p>
          © {new Date().getFullYear()} FactureCheck — Mentions légales ·
          Politique de confidentialité
        </p>
      </footer>
    </>
  );
}
