import { describe, expect, it } from "vitest";
import demos from "@/lib/demo-definitions.json";

describe("judge demo definitions", () => {
  it("contains five inputs-only demos", () => {
    expect(demos).toHaveLength(5);
    for (const demo of demos) {
      expect(Object.keys(demo).sort()).toEqual(["id", "input", "title", "watchFor"].sort());
      expect(demo.input).toHaveProperty("business_name");
      expect(demo.input).toHaveProperty("collaboration_goal");
      expect(demo.input).toHaveProperty("budget_min");
      expect(demo.input).toHaveProperty("budget_max");
      expect(demo).not.toHaveProperty("analysis");
      expect(demo).not.toHaveProperty("candidates");
      expect(demo).not.toHaveProperty("result");
    }
  });

  it("includes the requested seed and no-website inputs", () => {
    const blueBottle = demos.find((demo) => demo.id === "blue-bottle-san-francisco");
    const ordinary = demos.find((demo) => demo.id === "the-ordinary-new-york");
    const starbucks = demos.find((demo) => demo.id === "starbucks-chennai");
    const nike = demos.find((demo) => demo.id === "nike-portland");
    const invented = demos.find((demo) => demo.id === "qvxxqz-blorpblorp-boise");

    expect(blueBottle?.input.budget_min).toBe("0");
    expect(blueBottle?.input.budget_max).toBe("500");
    expect(blueBottle?.input.event_requirements).toContain("One-day pop-up");
    expect(ordinary?.input.seed_brands).toEqual(["Sephora", "Glossier"]);
    expect(ordinary?.input.budget_min).toBe("100");
    expect(ordinary?.input.budget_max).toBe("1000");
    expect(starbucks?.input.city).toBe("Chennai");
    expect(starbucks?.input.collaboration_goal).toMatch(/small community .*pop-up/);
    expect(nike?.input.industry).toBe("Clothes");
    expect(nike?.input.city).toBe("Portland, Oregon");
    expect(nike?.input.event_requirements).toContain("One-day community pop-up");
    expect(invented?.input.website).toBe("");
    expect(invented?.input.business_name).toBe("Qvxxqz Blorpblorp");
  });
});
