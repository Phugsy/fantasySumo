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
        onForgotPassword={vi.fn()}
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

    const signInButtons = screen.getAllByRole("button", {
      name: "Sign in",
    });
    const signInSubmitButton = signInButtons[1];

    if (signInSubmitButton === undefined) {
      throw new Error("Expected sign-in submit button.");
    }

    expect(signInSubmitButton).toBeEnabled();
    expect(screen.queryByLabelText("Display name")).not.toBeInTheDocument();

    fireEvent.click(signInSubmitButton);

    expect(onSignIn).toHaveBeenCalled();
  });

  it("requires a display name only when registering with Neon", () => {
    const onSignUp = vi.fn();

    render(
      <AccountPanel
        email="player@example.com"
        errorMessage={null}
        mode="neon"
        onDisplayNameChange={vi.fn()}
        onEmailChange={vi.fn()}
        onForgotPassword={vi.fn()}
        onPasswordChange={vi.fn()}
        onSignIn={vi.fn()}
        onSignOut={vi.fn()}
        onSignUp={onSignUp}
        password="strong-password"
        sessionState="ready"
        user={null}
        userDisplayName=""
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Forgot password?" }),
    ).not.toBeInTheDocument();
  });

  it("offers password recovery only from Neon sign in", () => {
    const onForgotPassword = vi.fn();

    render(
      <AccountPanel
        email="player@example.com"
        errorMessage={null}
        mode="neon"
        onDisplayNameChange={vi.fn()}
        onEmailChange={vi.fn()}
        onForgotPassword={onForgotPassword}
        onPasswordChange={vi.fn()}
        onSignIn={vi.fn()}
        onSignOut={vi.fn()}
        onSignUp={vi.fn()}
        password=""
        sessionState="ready"
        user={null}
        userDisplayName=""
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));

    expect(onForgotPassword).toHaveBeenCalledOnce();
  });
});
