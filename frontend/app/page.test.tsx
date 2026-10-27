import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChoicePanel } from "@/app/page";
import type { Analysis, DiscoveryRequest, Place } from "@/lib/contracts";

afterEach(cleanup);

const firstLocation: Place = {
  osm_type: "node",
  osm_id: 101,
  name: "Domino's Pizza",
  display_name: "Domino's Pizza, Deonar, Mumbai",
  category: "amenity",
  type: "restaurant",
  lat: "19.0",
  lon: "72.8",
};
const secondLocation: Place = {
  ...firstLocation,
  osm_id: 102,
  display_name: "Domino's Pizza, Bandra, Mumbai",
};

const identity: Analysis["discovery"]["business_identity"] = {
  status: "needs_user_choice",
  osm_status: "ambiguous",
  qloo_status: "not_attempted",
  osm_options: [firstLocation, secondLocation],
  qloo_options: [],
  seed_resolutions: [],
  selected_osm_place: null,
  selected_osm_any_location: false,
  selected_qloo_entity: null,
  evidence: [],
  limitations: [],
};

const request: DiscoveryRequest = {
  brief: {
    business_name: "Domino's Pizza",
    industry: "pizza",
    website: null,
    identifying_info: "Local restaurant",
    city: "Mumbai",
    target_market: null,
    collaboration_goal: "Host a small event",
    budget_range: { minimum: 100, maximum: 500, currency: "USD" },
    event_requirements: [],
    constraints: [],
  },
  seed_brands: [],
};

describe("business identity choices", () => {
  it("keeps each location selectable and offers the any-location brand option", () => {
    const onSubmit = vi.fn();
    render(
      <ChoicePanel
        identity={identity}
        onEdit={vi.fn()}
        onSubmit={onSubmit}
        request={request}
        submitting={false}
      />,
    );

    expect(screen.getByRole("radio", { name: /Deonar, Mumbai/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Bandra, Mumbai/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Any location (use the brand)" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue with selected records" }));

    expect(onSubmit).toHaveBeenCalledWith({
      ...request,
      selected_osm_any_location: true,
    });
  });

  it("continues with the explicitly selected individual location", () => {
    const onSubmit = vi.fn();
    render(
      <ChoicePanel
        identity={identity}
        onEdit={vi.fn()}
        onSubmit={onSubmit}
        request={request}
        submitting={false}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /Deonar, Mumbai/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue with selected records" }));

    expect(onSubmit).toHaveBeenCalledWith({
      ...request,
      selected_osm_type: "node",
      selected_osm_id: 101,
    });
  });
});
