import type { FormEvent } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountPanel } from "./AccountPanel";

describe("AccountPanel", () => {
  it("allows Neon sign in without a display name", () => {
    const onSignIn = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    render(
      <AccountPanel
        email="player@example.com"
        errorMessage={null}
        mode="neon"
        onDisplayNameChange={vi.fn()}
        onEmailChange={vi.fn()}
        onPasswordChange={vi.fn()}
        onSignIn={onSignIn}
        onSignOut={vi.fn()}
        onSignUp={vi.fn()}
        password="strong-password"
        sessionState="ready"
        user={null}
        userDisplayName=""
      />,
    );

    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(onSignIn).toHaveBeenCalled();
  });
});
