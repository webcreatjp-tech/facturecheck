// Constantes et helpers purs pour l'upload de factures.
// Séparés de upload.ts (use server) pour pouvoir être importés côté client.

export const UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 Mo
export const UPLOAD_ALLOWED_MIME = "application/pdf";
export const STORAGE_BUCKET = "invoices";
export const UPLOADS_PER_PAGE = 10;

/**
 * Génère un slug URL-safe à partir du nom de fichier.
 * Retire l'extension .pdf, remplace les caractères spéciaux par des tirets.
 */
export function slugify(name: string): string {
  const withoutExt = name.replace(/\.pdf$/i, "");
  const slug = withoutExt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "facture";
}

/**
 * Construit le chemin de stockage unique par utilisateur.
 * Format : {userId}/{timestamp}-{slug}.pdf
 */
export function buildStoragePath(userId: string, fileName: string): string {
  return `${userId}/${Date.now()}-${slugify(fileName)}.pdf`;
}
