import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EmailSignupForm from "./EmailSignupForm";

// Mock the API module so tests are instant and don't hit the network
vi.mock("@/lib/api", () => ({
  registerWaitlistEmail: vi.fn().mockResolvedValue(undefined),
}));

describe("EmailSignupForm", () => {
  it("renders the email input and submit button", () => {
    render(<EmailSignupForm />);
    expect(screen.getByLabelText("Adresse email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /essai gratuit/i })
    ).toBeInTheDocument();
  });

  it("input accepts email values", async () => {
    const user = userEvent.setup();
    render(<EmailSignupForm />);
    const input = screen.getByLabelText("Adresse email");
    await user.type(input, "test@example.fr");
    expect(input).toHaveValue("test@example.fr");
  });

  it("shows a success message after successful submission", async () => {
    const user = userEvent.setup();
    render(<EmailSignupForm />);
    await user.type(screen.getByLabelText("Adresse email"), "test@example.fr");
    await user.click(screen.getByRole("button", { name: /essai gratuit/i }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /vérifiez votre boîte mail/i
      )
    );
  });

  it("hides the form after successful submission", async () => {
    const user = userEvent.setup();
    render(<EmailSignupForm />);
    await user.type(screen.getByLabelText("Adresse email"), "me@test.fr");
    await user.click(screen.getByRole("button", { name: /essai gratuit/i }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toBeInTheDocument()
    );
    expect(screen.queryByLabelText("Adresse email")).not.toBeInTheDocument();
  });
});
