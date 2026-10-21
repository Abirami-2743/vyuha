import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SavedRunBanner } from "@/components/saved-run-banner";

describe("SavedRunBanner", () => {
  it("labels the captured result as not live", () => {
    render(
      <SavedRunBanner
        capturedAt="2026-10-17T12:00:00Z"
        liveError="The AI service is busy, try again in a minute or view the saved result"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      /Saved result, not live · captured/,
    );
    expect(screen.getByRole("status")).toHaveTextContent("2026");
    expect(screen.getByRole("status")).toHaveTextContent(
      "The AI service is busy, try again in a minute or view the saved result",
    );
  });
});
