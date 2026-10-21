import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteHeader } from "@/components/site-header";

afterEach(cleanup);

describe("site navigation", () => {
  it("omits Back on Home while keeping Home and About links", () => {
    render(
      <SiteHeader
        backLabel="home"
        backText="← Back"
        onAbout={vi.fn()}
        onBack={vi.fn()}
        onHome={vi.fn()}
        route="/"
      />,
    );

    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "About" })).toBeInTheDocument();
  });

  it.each(["/about", "/demos", "/analyze", "/result", "/result/evidence"])(
    "keeps Back on %s",
    (route) => {
      render(
        <SiteHeader
          backLabel="home"
          backText="← Back"
          onAbout={vi.fn()}
          onBack={vi.fn()}
          onHome={vi.fn()}
          route={route}
        />,
      );

      expect(screen.getByRole("button", { name: "Back to home" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Home" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "About" })).toBeInTheDocument();
    },
  );
});
