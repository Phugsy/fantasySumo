import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { PhotoCredits, RikishiPhoto } from "./RikishiPhoto";

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
