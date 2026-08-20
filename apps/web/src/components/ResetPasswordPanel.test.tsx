import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import {
  INVALID_PASSWORD_RESET_LINK_MESSAGE,
  PASSWORD_RESET_CONFIRMATION_MESSAGE,
} from "../authClient";
import { ResetPasswordPanel } from "./ResetPasswordPanel";

describe("ResetPasswordPanel", () => {
  it("requests a link with neutral confirmation and prevents duplicate submissions", async () => {
    let releaseRequest: () => void = () => undefined;
    const requestMayFinish = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    const onRequestReset = vi.fn(() => requestMayFinish);

    renderPanel({
      initialEmail: "player@example.com",
      onRequestReset,
    });

    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(onRequestReset).toHaveBeenCalledWith("player@example.com");
    expect(
      screen.getByRole("button", { name: "Requesting reset link..." }),
    ).toBeDisabled();

    releaseRequest();

    expect(
      await screen.findByText(PASSWORD_RESET_CONFIRMATION_MESSAGE),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Request another link" }),
    ).toBeInTheDocument();
  });

  it("validates matching passwords and completes a valid token reset", async () => {
    const onResetPassword = vi.fn(async () => undefined);

    renderPanel({ token: "valid-token", onResetPassword });

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "strong-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "different-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The passwords do not match.",
    );
    expect(onResetPassword).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "strong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    await waitFor(() =>
      expect(onResetPassword).toHaveBeenCalledWith(
        "strong-password",
        "valid-token",
      ),
    );
    expect(
      await screen.findByRole("link", { name: "Continue to sign in" }),
    ).toHaveAttribute("href", "/login?returnTo=%2Fstable");
  });

  it("turns invalid provider redirects into an actionable request form", () => {
    renderPanel({ invalidLink: true });

    expect(screen.getByRole("alert")).toHaveTextContent(
      INVALID_PASSWORD_RESET_LINK_MESSAGE,
    );
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send reset link" }),
    ).toBeInTheDocument();
  });

  it("lets a player recover when token completion reports an expired link", async () => {
    const onResetPassword = vi.fn(async () => {
      throw new Error(INVALID_PASSWORD_RESET_LINK_MESSAGE);
    });

    renderPanel({ token: "expired-token", onResetPassword });

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "strong-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "strong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));

    const requestNewLink = await screen.findByRole("button", {
      name: "Request a new link",
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      INVALID_PASSWORD_RESET_LINK_MESSAGE,
    );

    fireEvent.click(requestNewLink);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("keeps local development sign-in passwordless", () => {
    renderPanel({ mode: "local" });

    expect(
      screen.getByRole("heading", { name: "Password reset is unavailable" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument();
  });
});

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof ResetPasswordPanel>> = {},
) {
  return render(
    <MemoryRouter>
      <ResetPasswordPanel
        invalidLink={false}
        mode="neon"
        onRequestReset={vi.fn(async () => undefined)}
        onResetPassword={vi.fn(async () => undefined)}
        returnTo="/stable"
        token={null}
        {...overrides}
      />
    </MemoryRouter>,
  );
}
