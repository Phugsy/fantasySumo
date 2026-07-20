import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DailyScoreBadge } from "./DailyScoreBadge";

describe("DailyScoreBadge", () => {
  it("formats positive and zero daily scores", () => {
    const { rerender } = render(<DailyScoreBadge score={2} />);

    expect(screen.getByText("+2")).toHaveClass("daily-score-badge");

    rerender(<DailyScoreBadge score={0} />);

    expect(screen.getByText("0")).toHaveClass("daily-score-badge");
  });
});
