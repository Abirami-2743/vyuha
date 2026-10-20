import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SavedRunBanner } from "@/components/saved-run-banner";

describe("SavedRunBanner", () => {
  it("labels the captured result as not live", () => {
    render(<SavedRunBanner capturedAt="2026-10-17T12:00:00Z" />);

    expect(screen.getByRole("status")).toHaveTextContent(/Saved run from .*not live/);
  });
});
