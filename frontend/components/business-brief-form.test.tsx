import { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BusinessBriefForm } from "@/components/business-brief-form";
import { briefExamples, emptyBrief, type BriefFields } from "@/lib/brief";
import type { DiscoveryRequest } from "@/lib/contracts";

afterEach(cleanup);

function Harness({ onSubmit }: { onSubmit: (request: DiscoveryRequest) => void }) {
  const [values, setValues] = useState<BriefFields>(emptyBrief);
  return (
    <BusinessBriefForm
      onChange={(field, value) => setValues((current) => ({ ...current, [field]: value }))}
      onSubmit={onSubmit}
      submitting={false}
      values={values}
    />
  );
}

describe("business brief form", () => {
  it("starts blank, including both budget fields, and shows examples only as placeholders", () => {
    render(<Harness onSubmit={vi.fn()} />);

    expect(screen.getByLabelText(/Business name/)).toHaveValue("");
    expect(screen.getByLabelText(/^Industry$/)).toHaveValue("");
    expect(screen.getByLabelText(/^City/)).toHaveValue("");
    expect(screen.getByLabelText(/Broader target market/)).toHaveValue("");
    expect(screen.getByLabelText(/Website \(or short description\)/)).toHaveValue("");
    expect(screen.getByLabelText(/Short description \(or website\)/)).toHaveValue("");
    expect(screen.getByLabelText(/Collaboration goal/)).toHaveValue("");
    expect(screen.getByLabelText("Minimum")).toHaveValue(null);
    expect(screen.getByLabelText("Maximum")).toHaveValue(null);
    expect(screen.getByLabelText(/Event requirements/)).toHaveValue("");
    expect(screen.getByLabelText(/^Constraints/)).toHaveValue("");
    expect(screen.getByLabelText(/Optional seed brands/)).toHaveValue("");
    expect(screen.getByLabelText(/Business name/)).toHaveAttribute(
      "placeholder",
      "e.g. Your business name",
    );
  });

  it.each(briefExamples.map(({ label }) => label))(
    "fills every field from the %s example without submitting",
    async (label) => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<Harness onSubmit={onSubmit} />);

      await user.click(screen.getByRole("button", { name: label }));
      const example = briefExamples.find((item) => item.label === label);
      expect(example).toBeDefined();
      for (const [field, value] of Object.entries(example!.fields)) {
        const labelMap: Record<keyof BriefFields, RegExp | string> = {
          businessName: /Business name/,
          industry: /^Industry$/,
          city: /^City/,
          targetMarket: /Broader target market/,
          website: /Website \(or short description\)/,
          identifyingInfo: /Short description \(or website\)/,
          goal: /Collaboration goal/,
          budgetMin: "Minimum",
          budgetMax: "Maximum",
          requirements: /Event requirements/,
          constraints: /^Constraints/,
          seeds: /Optional seed brands/,
        };
        expect(screen.getByLabelText(labelMap[field as keyof BriefFields])).toHaveValue(
          field === "budgetMin" || field === "budgetMax" ? Number(value) : value,
        );
      }
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it("submits only the currently selected and edited example, with no prior business text", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Cafe" }));
    await user.click(screen.getByRole("button", { name: "Bookstore" }));
    await user.clear(screen.getByLabelText(/Business name/));
    await user.type(screen.getByLabelText(/Business name/), "My own bookstore");
    await user.click(screen.getByRole("button", { name: "Discover partners" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const request = onSubmit.mock.calls[0][0] as DiscoveryRequest;
    expect(request.brief.business_name).toBe("My own bookstore");
    expect(request.brief.industry).toBe("Books");
    expect(request.brief.collaboration_goal).toBe(briefExamples[3].fields.goal);
    expect(request.brief.event_requirements).toEqual(
      briefExamples[3].fields.requirements.split("\n"),
    );
    expect(request.seed_brands.map((seed) => seed.name)).toEqual(
      briefExamples[3].fields.seeds.split("\n"),
    );
    expect(JSON.stringify(request)).not.toContain("Your cafe");
    expect(JSON.stringify(request)).not.toContain("neighborhood cafe");
  });

  it("explains missing website or description beside the fields and focuses the first one", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Cafe" }));
    await user.clear(screen.getByLabelText(/Website \(or short description\)/));
    await user.clear(screen.getByLabelText(/Short description \(or website\)/));
    await user.click(screen.getByRole("button", { name: "Discover partners" }));

    expect(screen.getByText(/Either one is enough/)).toBeInTheDocument();
    expect(
      screen.getByRole("alert"),
    ).toHaveTextContent("Add a website or a short description");
    const website = screen.getByLabelText(/Website \(or short description\)/);
    expect(website).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(website).toHaveFocus());
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
