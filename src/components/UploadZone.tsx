"use client";

import { useRef, useState, useCallback, useId } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  uploadInvoice,
  UPLOAD_MAX_BYTES,
  UPLOAD_ALLOWED_MIME,
  type UploadRecord,
} from "@/app/actions/upload";

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

type UploadState = "idle" | "selected" | "loading" | "success" | "error";

interface UploadZoneProps {
  /** Callback déclenché après un upload réussi (pour mise à jour optimiste). */
  onUploadSuccess?: (upload: UploadRecord) => void;
  /** Si true, l'upload est désactivé (quota mensuel atteint). */
  quotaReached?: boolean;
}

// --------------------------------------------------------------------------
// Messages d'erreur (côté client et serveur)
// --------------------------------------------------------------------------

const ERROR_MESSAGES: Record<string, string> = {
  invalid_type: "Seuls les fichiers PDF sont acceptés.",
  too_large: `Le fichier dépasse la taille limite de ${UPLOAD_MAX_BYTES / 1024 / 1024} Mo.`,
  unauthenticated: "Vous devez être connecté pour téléverser une facture.",
  quota_exceeded:
    "Vous avez atteint votre limite mensuelle de factures. Passez à un plan supérieur pour continuer.",
  upload_error: "Le téléversement a échoué. Veuillez réessayer.",
};

// --------------------------------------------------------------------------
// Composant
// --------------------------------------------------------------------------

export default function UploadZone({
  onUploadSuccess,
  quotaReached = false,
}: UploadZoneProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const statusId = useId();

  const [state, setState] = useState<UploadState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // -------------- Validation client ----------------------------------------

  function validateFile(file: File): string | null {
    if (file.type !== UPLOAD_ALLOWED_MIME) return "invalid_type";
    if (file.size > UPLOAD_MAX_BYTES) return "too_large";
    return null;
  }

  function setError(code: string) {
    setState("error");
    setErrorMsg(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.upload_error);
  }

  // -------------- Sélection de fichier -------------------------------------

  const handleFileSelect = useCallback((file: File) => {
    const errorCode = validateFile(file);
    if (errorCode) {
      setError(errorCode);
      return;
    }
    setSelectedFile(file);
    setState("selected");
    setErrorMsg("");
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    // Réinitialise la valeur pour permettre de sélectionner le même fichier
    e.target.value = "";
  }

  function handleClick() {
    fileInputRef.current?.click();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }

  // -------------- Drag & Drop ----------------------------------------------

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  // -------------- Soumission -----------------------------------------------

  async function handleUpload() {
    if (!selectedFile) return;

    setState("loading");
    setErrorMsg("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    const result = await uploadInvoice(formData);

    if (!result.success) {
      setError(result.code);
      return;
    }

    setState("success");
    setSelectedFile(null);
    onUploadSuccess?.(result.upload);
    router.refresh(); // re-rend le Server Component UploadHistory
  }

  function handleReset() {
    setState("idle");
    setSelectedFile(null);
    setErrorMsg("");
  }

  // -------------- Rendu ----------------------------------------------------

  if (quotaReached) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-red-200 bg-red-50 p-10 text-center">
        <AlertCircle className="h-10 w-10 text-red-400" aria-hidden />
        <div>
          <p className="font-semibold text-red-700">Quota mensuel atteint</p>
          <p className="mt-1 text-sm text-red-500">
            Passez à un plan supérieur pour téléverser d&apos;autres factures.
          </p>
        </div>
        <a
          href="/dashboard/billing"
          className="mt-1 text-sm font-medium text-red-700 underline underline-offset-2 hover:text-red-900"
        >
          Voir les plans →
        </a>
      </div>
    );
  }

  return (
    <section aria-label="Téléversement de facture PDF">
      {/* Zone principale */}
      <div
        role="button"
        tabIndex={state === "loading" ? -1 : 0}
        aria-label="Zone de dépôt de fichier. Cliquez ou glissez un PDF ici."
        aria-describedby={statusId}
        aria-disabled={state === "loading"}
        onClick={state === "loading" ? undefined : handleClick}
        onKeyDown={state === "loading" ? undefined : handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={state === "loading" ? undefined : handleDrop}
        className={[
          "relative flex flex-col items-center justify-center gap-4",
          "rounded-2xl border-2 border-dashed p-10 text-center",
          "cursor-pointer transition-all duration-150",
          isDragOver
            ? "border-blue-400 bg-blue-50"
            : state === "success"
            ? "border-green-300 bg-green-50"
            : state === "error"
            ? "border-red-300 bg-red-50"
            : "border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/50",
          state === "loading" ? "pointer-events-none opacity-70" : "",
        ].join(" ")}
      >
        {/* Input caché */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="sr-only"
          aria-hidden="true"
          onChange={handleInputChange}
          tabIndex={-1}
        />

        {/* Icône selon l'état */}
        {state === "success" ? (
          <CheckCircle className="h-10 w-10 text-green-500" aria-hidden />
        ) : state === "error" ? (
          <AlertCircle className="h-10 w-10 text-red-400" aria-hidden />
        ) : state === "selected" || state === "loading" ? (
          <FileText className="h-10 w-10 text-blue-500" aria-hidden />
        ) : (
          <Upload className="h-10 w-10 text-gray-400" aria-hidden />
        )}

        {/* Texte selon l'état */}
        <div>
          {state === "idle" && (
            <>
              <p className="font-semibold text-gray-700">
                Glissez votre PDF ici
              </p>
              <p className="mt-1 text-sm text-gray-400">
                ou cliquez pour parcourir — max{" "}
                {UPLOAD_MAX_BYTES / 1024 / 1024} Mo
              </p>
            </>
          )}
          {state === "selected" && selectedFile && (
            <>
              <p className="font-semibold text-gray-700 break-all">
                {selectedFile.name}
              </p>
              <p className="mt-1 text-sm text-gray-400">
                {(selectedFile.size / 1024).toFixed(0)} Ko
              </p>
            </>
          )}
          {state === "loading" && (
            <p className="font-semibold text-blue-600">Téléversement…</p>
          )}
          {state === "success" && (
            <p className="font-semibold text-green-600">
              Facture téléversée avec succès&nbsp;!
            </p>
          )}
          {state === "error" && (
            <p className="font-semibold text-red-600">Fichier non accepté</p>
          )}
        </div>
      </div>

      {/* Message de statut / erreur accessible */}
      <div id={statusId} aria-live="polite" aria-atomic="true">
        {state === "error" && (
          <p role="alert" className="mt-3 text-sm text-red-600 text-center">
            {errorMsg}
          </p>
        )}
        {state === "success" && (
          <p className="mt-3 text-sm text-green-600 text-center">
            Le fichier apparaît maintenant dans votre historique ci-dessous.
          </p>
        )}
      </div>

      {/* Boutons d'action */}
      <div className="mt-4 flex gap-3 justify-center flex-wrap">
        {state === "selected" && (
          <>
            <Button onClick={handleUpload} size="default">
              Téléverser la facture
            </Button>
            <Button onClick={handleReset} variant="outline" size="default">
              Annuler
            </Button>
          </>
        )}
        {(state === "success" || state === "error") && (
          <Button onClick={handleReset} variant="outline" size="default">
            {state === "success"
              ? "Téléverser une autre facture"
              : "Réessayer"}
          </Button>
        )}
      </div>
    </section>
  );
}
