import type { DiscoveryRequest } from "@/lib/contracts";

export type BriefFields = {
  businessName: string;
  industry: string;
  city: string;
  targetMarket: string;
  website: string;
  identifyingInfo: string;
  goal: string;
  budgetMin: string;
  budgetMax: string;
  requirements: string;
  constraints: string;
  seeds: string;
};

export const emptyBrief: BriefFields = {
  businessName: "",
  industry: "",
  city: "",
  targetMarket: "",
  website: "",
  identifyingInfo: "",
  goal: "",
  budgetMin: "",
  budgetMax: "",
  requirements: "",
  constraints: "",
  seeds: "",
};

export const briefExamples: Array<{ label: string; fields: BriefFields }> = [
  {
    label: "Cafe",
    fields: {
      businessName: "Your cafe",
      industry: "Cafe",
      city: "Your city",
      targetMarket: "People who live or work nearby",
      website: "https://example.com",
      identifyingInfo: "An independent neighborhood cafe",
      goal: "Explore a small local event and learn whether a partnership is worth testing.",
      budgetMin: "0",
      budgetMax: "300",
      requirements: "A small shared event\nA way to serve food or drinks",
      constraints: "Keep costs low\nConfirm availability before committing",
      seeds: "A local bakery",
    },
  },
  {
    label: "Skincare shop",
    fields: {
      businessName: "Your skincare shop",
      industry: "Skincare",
      city: "Your city",
      targetMarket: "Local skincare shoppers",
      website: "https://example.com",
      identifyingInfo: "An independent skincare shop",
      goal: "Try a small product discovery event with a local business.",
      budgetMin: "50",
      budgetMax: "500",
      requirements: "A small product display\nA short in-person event",
      constraints: "Avoid large upfront costs\nCheck product and venue requirements",
      seeds: "A local wellness shop",
    },
  },
  {
    label: "Gym",
    fields: {
      businessName: "Your gym",
      industry: "Fitness",
      city: "Your city",
      targetMarket: "People interested in local fitness",
      website: "https://example.com",
      identifyingInfo: "An independent neighborhood gym",
      goal: "Explore a beginner-friendly community event with a local partner.",
      budgetMin: "0",
      budgetMax: "400",
      requirements: "A short beginner-friendly activity\nSpace for a small group",
      constraints: "Check insurance and safety needs\nAvoid equipment purchases",
      seeds: "A local health food shop",
    },
  },
  {
    label: "Bookstore",
    fields: {
      businessName: "Your bookstore",
      industry: "Books",
      city: "Your city",
      targetMarket: "Readers in the local community",
      website: "https://example.com",
      identifyingInfo: "An independent neighborhood bookstore",
      goal: "Test a small community gathering with a business from another category.",
      budgetMin: "0",
      budgetMax: "250",
      requirements: "A small reading or discussion event\nShared promotion",
      constraints: "Keep the event low-cost\nConfirm the partner's availability",
      seeds: "A local arts organization",
    },
  },
];

export type BriefValidation = {
  request: DiscoveryRequest | null;
  message: string | null;
  invalidFields: Array<keyof BriefFields>;
};

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function validateBrief(values: BriefFields): BriefValidation {
  const minimum = Number(values.budgetMin);
  const maximum = Number(values.budgetMax);
  const seeds = lines(values.seeds);
  const requirements = lines(values.requirements);
  const constraints = lines(values.constraints);

  if (!values.businessName.trim()) {
    return { request: null, message: "Enter your business name.", invalidFields: ["businessName"] };
  }
  if (
    values.businessName.trim().length > 160 ||
    values.industry.trim().length > 160 ||
    values.city.trim().length > 120 ||
    values.targetMarket.trim().length > 240
  ) {
    return {
      request: null,
      message: "Business name, industry, city, or target market is too long.",
      invalidFields: ["businessName", "industry", "city", "targetMarket"],
    };
  }
  if (!values.goal.trim() || values.goal.trim().length < 10) {
    return {
      request: null,
      message: "Describe your collaboration goal in at least 10 characters.",
      invalidFields: ["goal"],
    };
  }
  if (values.goal.trim().length > 2000 || values.identifyingInfo.trim().length > 1000) {
    return {
      request: null,
      message: "Your goal or business description is too long.",
      invalidFields: ["goal", "identifyingInfo"],
    };
  }
  if (
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    values.budgetMin.trim() === "" ||
    values.budgetMax.trim() === "" ||
    minimum < 0 ||
    maximum < minimum
  ) {
    return {
      request: null,
      message: "Enter a valid budget; the maximum must be at least the minimum.",
      invalidFields:
        values.budgetMin.trim() === "" || minimum < 0 ? ["budgetMin"] : ["budgetMax"],
    };
  }
  if (!values.city.trim() && !values.targetMarket.trim()) {
    return {
      request: null,
      message: "Enter a city or a broader target market.",
      invalidFields: ["city", "targetMarket"],
    };
  }
  if (!values.website.trim() && !values.identifyingInfo.trim()) {
    return {
      request: null,
      message: "Add a website or a short description so Vyuha can identify the business.",
      invalidFields: ["website", "identifyingInfo"],
    };
  }
  if (
    (values.website.trim() && !/^https?:\/\/.+/i.test(values.website.trim())) ||
    (values.website.trim() && !URL.canParse(values.website.trim()))
  ) {
    return {
      request: null,
      message: "Enter a complete website address starting with http:// or https://.",
      invalidFields: ["website"],
    };
  }
  if (seeds.length > 3) {
    return { request: null, message: "Add no more than 3 seed brands.", invalidFields: ["seeds"] };
  }
  if (new Set(seeds.map((seed) => seed.toLocaleLowerCase())).size !== seeds.length) {
    return { request: null, message: "Seed brands must be distinct.", invalidFields: ["seeds"] };
  }
  if (seeds.some((seed) => seed.length > 160)) {
    return {
      request: null,
      message: "Each seed brand must be 160 characters or fewer.",
      invalidFields: ["seeds"],
    };
  }
  if (requirements.length > 30 || constraints.length > 30) {
    return {
      request: null,
      message: "Enter no more than 30 requirements and 30 constraints.",
      invalidFields: ["requirements", "constraints"],
    };
  }
  if ([...requirements, ...constraints].some((item) => item.length > 500)) {
    return {
      request: null,
      message: "Each requirement and constraint must be 500 characters or fewer.",
      invalidFields: ["requirements", "constraints"],
    };
  }

  return {
    message: null,
    invalidFields: [],
    request: {
      brief: {
        business_name: values.businessName.trim(),
        industry: values.industry.trim() || null,
        city: values.city.trim() || null,
        target_market: values.targetMarket.trim() || null,
        website: values.website.trim() || null,
        identifying_info: values.identifyingInfo.trim() || null,
        collaboration_goal: values.goal.trim(),
        budget_range: { minimum, maximum, currency: "USD" },
        event_requirements: requirements,
        constraints,
      },
      seed_brands: seeds.map((name) => ({ name })),
    },
  };
}
