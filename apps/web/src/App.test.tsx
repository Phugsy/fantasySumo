import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the foundation smoke page", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Fantasy Sumo" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Vite + React")).toBeInTheDocument();
    expect(screen.getByText("Fastify")).toBeInTheDocument();
  });
});
