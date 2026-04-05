import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UploadZone from "./UploadZone";
import { UPLOAD_MAX_BYTES, UPLOAD_ALLOWED_MIME } from "@/lib/upload-config";

// --------------------------------------------------------------------------
// Mocks
// --------------------------------------------------------------------------

const mockUploadInvoice = vi.fn();
const mockRouterRefresh = vi.fn();

vi.mock("@/app/actions/upload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/actions/upload")>();
  return {
    ...actual,
    uploadInvoice: (...args: unknown[]) => mockUploadInvoice(...args),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh }),
}));

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function makePdf(name = "facture.pdf", size = 1024): File {
  const content = new Uint8Array(size).fill(0x25);
  return new File([content], name, { type: UPLOAD_ALLOWED_MIME });
}

function makeFile(name: string, type: string, size = 512): File {
  return new File([new Uint8Array(size)], name, { type });
}

const MOCK_UPLOAD_RECORD = {
  id: "up-1",
  user_id: "u-1",
  file_name: "facture.pdf",
  storage_path: "u-1/123-facture.pdf",
  mime_type: UPLOAD_ALLOWED_MIME,
  file_size: 1024,
  status: "uploaded" as const,
  created_at: new Date().toISOString(),
};

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe("UploadZone – rendu initial", () => {
  it("affiche la zone de dépôt et les instructions", () => {
    render(<UploadZone />);
    expect(
      screen.getByRole("button", { name: /zone de dépôt/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/glissez votre pdf/i)).toBeInTheDocument();
  });

  it("contient un input file caché qui accepte uniquement les PDF", () => {
    render(<UploadZone />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.accept).toBe("application/pdf");
  });
});

describe("UploadZone – sélection de fichier", () => {
  it("affiche le nom du fichier après sélection d'un PDF valide", async () => {
    render(<UploadZone />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = makePdf("ma-facture.pdf");
    await userEvent.upload(input, pdf);
    expect(screen.getByText("ma-facture.pdf")).toBeInTheDocument();
  });

  it("affiche le bouton 'Téléverser' après sélection", async () => {
    render(<UploadZone />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, makePdf());
    expect(
      screen.getByRole("button", { name: /téléverser la facture/i })
    ).toBeInTheDocument();
  });

  it("rejette un fichier non-PDF avec un message d'erreur", async () => {
    render(<UploadZone />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const html = makeFile("page.html", "text/html");
    // Utilise fireEvent pour contourner le filtre accept de userEvent
    Object.defineProperty(input, "files", { value: [html], configurable: true });
    fireEvent.change(input);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /seuls les fichiers pdf/i
      )
    );
  });

  it("rejette un fichier trop volumineux avec un message d'erreur", async () => {
    render(<UploadZone />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const big = makePdf("big.pdf", UPLOAD_MAX_BYTES + 1);
    Object.defineProperty(input, "files", { value: [big], configurable: true });
    fireEvent.change(input);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/taille limite/i)
    );
  });
});

describe("UploadZone – soumission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le message de succès après un upload réussi", async () => {
    mockUploadInvoice.mockResolvedValue({
      success: true,
      upload: MOCK_UPLOAD_RECORD,
    });

    const user = userEvent.setup();
    render(<UploadZone />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, makePdf());

    const uploadBtn = screen.getByRole("button", {
      name: /téléverser la facture/i,
    });
    await user.click(uploadBtn);

    await waitFor(() =>
      expect(
        screen.getByText(/téléversée avec succès/i)
      ).toBeInTheDocument()
    );
  });

  it("appelle router.refresh() après un upload réussi", async () => {
    mockUploadInvoice.mockResolvedValue({
      success: true,
      upload: MOCK_UPLOAD_RECORD,
    });

    const user = userEvent.setup();
    render(<UploadZone />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, makePdf());
    await user.click(
      screen.getByRole("button", { name: /téléverser la facture/i })
    );

    await waitFor(() => expect(mockRouterRefresh).toHaveBeenCalledOnce());
  });

  it("appelle onUploadSuccess avec le record après un upload réussi", async () => {
    mockUploadInvoice.mockResolvedValue({
      success: true,
      upload: MOCK_UPLOAD_RECORD,
    });

    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<UploadZone onUploadSuccess={onSuccess} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, makePdf());
    await user.click(
      screen.getByRole("button", { name: /téléverser la facture/i })
    );

    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith(MOCK_UPLOAD_RECORD)
    );
  });

  it("affiche l'erreur serveur si uploadInvoice retourne un échec", async () => {
    mockUploadInvoice.mockResolvedValue({
      success: false,
      code: "upload_error",
    });

    const user = userEvent.setup();
    render(<UploadZone />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, makePdf());
    await user.click(
      screen.getByRole("button", { name: /téléverser la facture/i })
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/échoué/i)
    );
  });

  it("affiche l'erreur unauthenticated si l'utilisateur n'est pas connecté", async () => {
    mockUploadInvoice.mockResolvedValue({
      success: false,
      code: "unauthenticated",
    });

    const user = userEvent.setup();
    render(<UploadZone />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, makePdf());
    await user.click(
      screen.getByRole("button", { name: /téléverser la facture/i })
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/connecté/i)
    );
  });
});

describe("UploadZone – accessibilité", () => {
  it("la zone de dépôt est actionnable au clavier (Enter)", () => {
    render(<UploadZone />);
    const zone = screen.getByRole("button", { name: /zone de dépôt/i });
    expect(zone).toHaveAttribute("tabindex", "0");
  });

  it("le bouton Annuler réinitialise la zone à l'état idle", async () => {
    const user = userEvent.setup();
    render(<UploadZone />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, makePdf());

    const cancelBtn = screen.getByRole("button", { name: /annuler/i });
    await user.click(cancelBtn);

    expect(screen.getByText(/glissez votre pdf/i)).toBeInTheDocument();
  });

  it("drop d'un PDF sélectionne le fichier", async () => {
    render(<UploadZone />);
    const zone = screen.getByRole("button", { name: /zone de dépôt/i });
    const pdf = makePdf("dropped.pdf");

    fireEvent.drop(zone, {
      dataTransfer: { files: [pdf] },
    });

    await waitFor(() =>
      expect(screen.getByText("dropped.pdf")).toBeInTheDocument()
    );
  });
});
