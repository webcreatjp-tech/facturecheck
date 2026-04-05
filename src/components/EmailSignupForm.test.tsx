import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmailSignupForm from "./EmailSignupForm";
import { WaitlistError } from "@/lib/api";

// Mock complet du module api — les tests restent indépendants de Supabase
const mockRegister = vi.fn();
vi.mock("@/lib/api", () => ({
  WaitlistError: class WaitlistError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = "WaitlistError";
      this.code = code;
    }
  },
  registerWaitlistEmail: (...args: unknown[]) => mockRegister(...args),
}));

beforeEach(() => {
  mockRegister.mockReset();
  mockRegister.mockResolvedValue(undefined); // succès par défaut
});

describe("EmailSignupForm – rendu", () => {
  it("affiche le champ email et le bouton 'Essai gratuit'", () => {
    render(<EmailSignupForm source="hero" />);
    expect(screen.getByLabelText("Adresse email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /essai gratuit/i })
    ).toBeInTheDocument();
  });

  it("différencie les id entre le formulaire hero et footer", () => {
    const { unmount } = render(<EmailSignupForm source="hero" />);
    expect(document.getElementById("signup-email-hero")).not.toBeNull();
    unmount();
    render(<EmailSignupForm source="footer" />);
    expect(document.getElementById("signup-email-footer")).not.toBeNull();
  });
});

describe("EmailSignupForm – saisie", () => {
  it("accepte la valeur saisie", async () => {
    const user = userEvent.setup();
    render(<EmailSignupForm source="hero" />);
    await user.type(screen.getByLabelText("Adresse email"), "test@example.fr");
    expect(screen.getByLabelText("Adresse email")).toHaveValue(
      "test@example.fr"
    );
  });
});

describe("EmailSignupForm – soumission réussie", () => {
  it("transmet l'email et la source à registerWaitlistEmail", async () => {
    const user = userEvent.setup();
    render(<EmailSignupForm source="footer" />);
    await user.type(
      screen.getByLabelText("Adresse email"),
      "marie@example.fr"
    );
    await user.click(screen.getByRole("button", { name: /essai gratuit/i }));

    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith("marie@example.fr", "footer")
    );
  });

  it("affiche le message de succès", async () => {
    const user = userEvent.setup();
    render(<EmailSignupForm source="hero" />);
    await user.type(screen.getByLabelText("Adresse email"), "test@example.fr");
    await user.click(screen.getByRole("button", { name: /essai gratuit/i }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /vérifiez votre boîte mail/i
      )
    );
  });

  it("masque le formulaire après le succès", async () => {
    const user = userEvent.setup();
    render(<EmailSignupForm source="hero" />);
    await user.type(screen.getByLabelText("Adresse email"), "me@test.fr");
    await user.click(screen.getByRole("button", { name: /essai gratuit/i }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toBeInTheDocument()
    );
    expect(screen.queryByLabelText("Adresse email")).not.toBeInTheDocument();
  });
});

describe("EmailSignupForm – erreurs", () => {
  it("affiche l'erreur email déjà inscrit", async () => {
    mockRegister.mockRejectedValue(
      new WaitlistError(
        "Cette adresse email est déjà inscrite sur la liste d'attente.",
        "duplicate"
      )
    );

    const user = userEvent.setup();
    render(<EmailSignupForm source="hero" />);
    await user.type(screen.getByLabelText("Adresse email"), "deja@inscrit.fr");
    await user.click(screen.getByRole("button", { name: /essai gratuit/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /déjà inscrite/i
      )
    );
  });

  it("affiche un message générique pour les erreurs serveur inconnues", async () => {
    mockRegister.mockRejectedValue(new Error("Network error"));

    const user = userEvent.setup();
    render(<EmailSignupForm source="footer" />);
    await user.type(screen.getByLabelText("Adresse email"), "x@y.fr");
    await user.click(screen.getByRole("button", { name: /essai gratuit/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /une erreur est survenue/i
      )
    );
  });

  it("associe aria-describedby à l'erreur", async () => {
    mockRegister.mockRejectedValue(new Error("fail"));

    const user = userEvent.setup();
    render(<EmailSignupForm source="hero" />);
    await user.type(screen.getByLabelText("Adresse email"), "x@y.fr");
    await user.click(screen.getByRole("button", { name: /essai gratuit/i }));

    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByLabelText("Adresse email")).toHaveAttribute(
      "aria-describedby",
      "signup-email-hero-error"
    );
  });
});
