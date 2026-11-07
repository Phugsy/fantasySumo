import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { DisplayPreferencesProvider } from "../DisplayPreferences";
import { DisplaySettings } from "./DisplaySettings";
import { PhotoCredits, RikishiPhoto } from "./RikishiPhoto";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps missing/failed photos bounded and decorative, with attributed sources", () => {
  const photo = {
    url: "/fixture.svg",
    sourceUrl: "https://example.com/source",
    author: "Photographer",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  };
  const view = render(
    <>
      <RikishiPhoto photo={photo} />
      <PhotoCredits photos={[photo, photo]} />
    </>,
  );
  const image = view.container.querySelector("img")!;
  expect(image).toHaveAttribute("alt", "");
  expect(image).toHaveAttribute("loading", "lazy");
  fireEvent.error(image);
  expect(view.container.querySelector("img")).toBeNull();
  expect(screen.getByText("No photo")).toBeInTheDocument();
  expect(screen.getAllByText("Photographer")).toHaveLength(1);
  expect(screen.getByText("CC BY-SA 4.0")).toHaveAttribute(
    "href",
    photo.licenseUrl,
  );
});

it("switches to illustrations with a distinct failed-image fallback and generated label", () => {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
  const view = render(
    <DisplayPreferencesProvider>
      <DisplaySettings />
      <RikishiPhoto illustration={{ url: "/ink.webp" }} />
      <PhotoCredits photos={[]} />
    </DisplayPreferencesProvider>,
  );
  fireEvent.change(screen.getByLabelText("Portrait style"), {
    target: { value: "illustrations" },
  });
  const image = view.container.querySelector("img")!;
  expect(image).toHaveAttribute("src", "/ink.webp");
  expect(
    screen.getByText("AI-generated ink illustrations"),
  ).toBeInTheDocument();
  fireEvent.error(image);
  expect(screen.getByText("No illustration")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Portrait style"), {
    target: { value: "photos" },
  });
  expect(screen.getByText("No photo")).toBeInTheDocument();
  expect(screen.queryByText("AI-generated ink illustrations")).toBeNull();
});
