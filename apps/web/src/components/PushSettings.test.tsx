import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import * as api from "../api";
import * as browser from "../push-browser";
import { PushSettings } from "./PushSettings";
vi.mock("../api", () => ({ fetchPushPreferences: vi.fn() }));
vi.mock("../push-browser", () => ({
  disableAllPush: vi.fn(),
  enablePush: vi.fn(),
  suspendPush: vi.fn(),
  pushSupport: vi.fn(),
  readPushConsent: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(browser.pushSupport).mockReturnValue(null);
  vi.mocked(browser.readPushConsent).mockResolvedValue(undefined);
});
it("shows unavailable state without offering enrollment", async () => {
  vi.mocked(api.fetchPushPreferences).mockResolvedValue({
    available: false,
    subscribed: false,
    revision: null,
  });
  render(<PushSettings ownerId="alice" sessionBusy={false} />);
  expect(
    await screen.findByText(
      "Reminders are not available for this account yet.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Enable on this device" }),
  ).not.toBeInTheDocument();
  expect(browser.enablePush).not.toHaveBeenCalled();
});
it("blocks unsupported/session-busy opt-in and explains device replacement", async () => {
  vi.mocked(api.fetchPushPreferences).mockResolvedValue({
    available: true,
    ownerId: "alice",
    subscribed: true,
    revision: "old",
    deviceId: "other-device",
  });
  vi.mocked(browser.pushSupport).mockReturnValue(
    "Add to your Home Screen first.",
  );
  render(<PushSettings ownerId="alice" sessionBusy />);
  expect(
    await screen.findByText(/Enabling here replaces it/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Enable on this device" }),
  ).toBeDisabled();
});
it("keeps cleanup available after a failed enrollment writes muted recovery state", async () => {
  vi.mocked(api.fetchPushPreferences).mockResolvedValue({
    available: true,
    ownerId: "alice",
    subscribed: false,
    revision: null,
  });
  vi.mocked(browser.enablePush).mockImplementation(async () => {
    vi.mocked(browser.readPushConsent).mockResolvedValue({
      ownerId: "alice",
      deviceId: "device",
      enabled: false,
    });
    throw new Error("Device remains muted.");
  });
  render(<PushSettings ownerId="alice" sessionBusy={false} />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Enable on this device" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Device remains muted.",
    ),
  );
  expect(
    screen.getByRole("button", { name: "Turn off on this device" }),
  ).toBeEnabled();
});
it("offers independent server opt-out when optional local storage is blocked", async () => {
  vi.mocked(api.fetchPushPreferences).mockResolvedValue({
    available: true,
    ownerId: "alice",
    subscribed: true,
    revision: "r",
  });
  vi.mocked(browser.readPushConsent).mockRejectedValue(
    new Error("storage blocked"),
  );
  render(<PushSettings ownerId="alice" sessionBusy={false} />);
  const disable = await screen.findByRole("button", {
    name: "Disable reminders everywhere",
  });
  expect(disable).toBeEnabled();
  expect(
    screen.getByRole("button", { name: "Enable on this device" }),
  ).toBeDisabled();
  fireEvent.click(disable);
  await waitFor(() =>
    expect(browser.disableAllPush).toHaveBeenCalledWith("alice"),
  );
});
it("shows the saved quiet-hours zone after the browser timezone changes", async () => {
  vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
    resolvedOptions: () => ({ timeZone: "Europe/London" }),
  } as Intl.DateTimeFormat);
  vi.mocked(api.fetchPushPreferences).mockResolvedValue({
    available: true,
    ownerId: "alice",
    subscribed: true,
    revision: "r",
    deviceId: "device",
    timezone: "Asia/Tokyo",
  });
  vi.mocked(browser.readPushConsent).mockResolvedValue({
    ownerId: "alice",
    deviceId: "device",
    enabled: true,
    revision: "r",
    timezone: "Asia/Tokyo",
  });
  const view = render(<PushSettings ownerId="alice" sessionBusy={false} />);
  expect(
    await screen.findByText("Reminders are on for this device."),
  ).toBeInTheDocument();
  expect(screen.getByText(/Quiet hours:/)).toHaveTextContent("Asia/Tokyo");
  expect(
    screen.getByText(
      "Turn off on this device, then enable again to use Europe/London.",
    ),
  ).toBeInTheDocument();
  view.unmount();
  vi.mocked(browser.readPushConsent).mockResolvedValue(undefined);
  render(<PushSettings ownerId="alice" sessionBusy={false} />);
  expect(
    await screen.findByText(/Enabling here replaces it/),
  ).toBeInTheDocument();
  expect(screen.getByText(/Quiet hours:/)).toHaveTextContent("Asia/Tokyo");
  expect(
    screen.getByText("Enabling on this device will use Europe/London."),
  ).toBeInTheDocument();
});
