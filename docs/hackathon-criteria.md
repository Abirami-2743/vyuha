# Qloo Agentic Hackathon 2026 — rules and judging

**Event:** Qloo Agentic Hackathon: Agents, but with taste.  
**Do not use** the 2025 “Qloo LLM Hackathon” criteria (`qloo-hackathon.devpost.com`). Those are a different contest.

Sources re-fetched and checked on October 14, 2026:

| Document | URL |
| --- | --- |
| Hackathon home (what to build, submit, judging copy) | https://qloo.devpost.com/ |
| Official Rules | https://qloo.devpost.com/rules |
| Schedule | https://qloo.devpost.com/details/dates |
| Resources (key + kit + Discord) | https://qloo.devpost.com/resources |
| Developer guide (API host, endpoints, cache, keys) | https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide |
| Starter kit | https://github.com/qloo/qloo-hackathon-kit |
| Devpost Terms (incorporated) | https://info.devpost.com/terms |
| Devpost Privacy | https://info.devpost.com/privacy |

The Official Rules were read from the official Devpost rules page in the browser. Direct page fetch returned HTTP 403; claims below are limited to text visible on that page. Listing-only claims are identified as such.

---

## 1. Dates (Official Rules §1)

| Period | Timing |
| --- | --- |
| Registration & Submission | September 30, 2026, 9:00 am ET – October 30, 2026, 11:45 pm ET |
| Judging | November 2, 2026, 12:00 pm ET – November 16, 2026, 11:45 pm ET |

After the submission period ends, Devpost submissions cannot be altered except as Sponsor/Devpost allow for IP/PII/inappropriate content (Rules §5).

---

## 2. What to build (listing + Rules §4)

From https://qloo.devpost.com/ :

> Build a working software application that integrates the Qloo API and either functions as an agentic tool, is built using an agent framework, or wires Qloo into an agent you already have.

The agent should **outperform generic LLM-only approaches because of Qloo**. If the submission would work the same without Qloo, it is the wrong thing.

Official Rules Project Requirements:

- Working software that integrates the Qloo API **and** either (a) functions as an agentic tool, (b) is built using an agent framework, or (c) integrates Qloo into an existing agent
- Capable of being installed and running consistently; must function as depicted
- New, **or** preexisting work that was **significantly updated with Qloo after the start of the Submission Period** (explain the update). The rules text contains a typo (“must have Qloo 4after”); treat the intent as: Qloo integration/update during the period
- Third-party SDKs/APIs/data: entrant must be authorized under those tools’ terms
- Must not have been developed with financial/preferential support from Sponsor/Administrator (conflict of interest)

Listing emphasis: cultural intelligence is the differentiator; not a demo of what LLMs already do.

---

## 3. Submission requirements (listing + Rules)

To be eligible, the listing requires **all** of:

1. **Link to a functional demo** — live, end-to-end, core features
2. **Public repo** — GitHub, GitLab, or Bitbucket; all source, assets, run instructions
3. **Text description** — features, what the agent/workflow does, what makes it **Qloo-powered**
4. **External hosting / fully published** — live website/web app, or hosted APK / TestFlight. **Local-only or private-access demos do not qualify** (listing)
5. **Open-source license** visible in the repo **About** section

The event listing explicitly says demo videos are not required. Judges may instead use the submitted text, images, and video rather than test the project (Rules §5).

Rules also require:

- Register on https://qloo.devpost.com/ (“Join Hackathon”)
- Obtain Qloo API access via the Google Form linked from the developer guide
- Complete required Devpost submission fields during the period
- English materials, or English translations of video, description, testing instructions, and other materials
- Original work, solely owned, no IP violation
- Access for judging: website, demo, or test build; if the website is private, include login credentials in testing instructions. Make the project available free of charge and without restriction to the Sponsor, Administrator, and Judges through the Judging Period (Rules §5).

The listing is stricter than the Rules on public access: it explicitly says demos relying on private access do not qualify. For submission eligibility, follow the listing and publish an externally hosted demo without a private-access wall. This resolves the earlier wording conflict rather than treating the listing claim as unsupported.

Multiple unique submissions are allowed (Rules).

---

## 4. Judging criteria (exact)

**Stage One (pass/fail):** whether the Project reasonably fits the theme and reasonably applies the required APIs/SDKs.

**Stage Two — equally weighted** (Rules §6; same four bullets on the listing):

1. **Technological Implementation** — How thoroughly and skillfully does the project use Qloo? Does the code reflect genuine effort and a working, non-trivial implementation?
2. **Design** — Does the project deliver a complete, coherent product experience, not just a technical proof of concept?
3. **Potential Impact** — Does the project make a credible, specific case for solving a real problem for a real audience and does the solution actually address that problem based on what's demonstrated?
4. **Quality of the Idea** — Is this a creative, non-obvious use of Qloo and does the team demonstrate genuine understanding of the problem space they're working in?

Ties: highest score on the first criterion, then the next, then judge vote.

Judges listed on the site (may change): Jason Calacanis, Mike Diolosa (CTO, Qloo), Nicole Seligman, Todd Boehly, Cedric the Entertainer, Michael Abrams.

Sponsor may use expert panels, peer review, automated AI-driven analysis, or a combination.

**Not 2026 criteria (do not design to these):** 2025 LLM hackathon’s “Intelligent & Thoughtful use of LLMs” five-criterion list.

## 5. Prizes (Rules §8 + listing)

| Place | Amount |
| --- | --- |
| 1st | $15,000 USD |
| 2nd | $6,000 USD |
| 3rd | $4,000 USD |

Each Project may win **one** prize. Listing also: Jason Calacanis may personally invest an additional $25,000 into his favorite entry (separate from the official prize table; not a Rules §8 prize).

---

## 6. Eligibility and restrictions (Rules §3, §4, §11)

**Open to:** age-of-majority individuals; teams; organizations existing at entry. All countries except standard exclusions.

**Not open to:** residents/orgs in places where US/local law prohibits (including Brazil, Quebec, Russia, Crimea, Cuba, Iran, North Korea, and OFAC comprehensively sanctioned countries); Promotion Entities and their employees/household/family; judges and their employers; affiliates; other conflict-of-interest cases.

**API / data restrictions from the 2026 developer guide:**

- Use `https://hackathon.api.qloo.com` only with the hackathon key
- Use documented endpoints/parameters; unsupported params are silently ignored
- Do not use `/recommendations` or `/recs`
- No private dataset required (“Qloo provides all the data you need through the API”) — complementary sources are not banned, but third-party tools must be licensed (Rules)
- Private server-side caching of Qloo responses is allowed; **do not put Qloo response data in a public repo**
- Keys last through judging, then are deactivated
- Quotas exist but numbers are unpublished; Discord `#api-help` for raises

**Terms:** Qloo Terms of Use apply to API data (see `docs/qloo-capabilities.md`). Devpost Terms and Privacy are incorporated; Official Rules control conflicts for this hackathon.

**IP:** Submission remains the entrant’s IP; Sponsor gets a non-exclusive license to judge and to promote the submission (name/likeness) during the event and three years after (Rules §7).

---

## 7. Implications for Vyuha

| Requirement | How Vyuha must satisfy it |
| --- | --- |
| Qloo is load-bearing | Cross-category Insights + critic using real affinity evidence; LLM-only partner lists fail Stage One / Quality / Tech |
| Agentic | Orchestrated pipeline with tools (search, insights, verify, critic, abstain) — not a single chat wrapper |
| Hosted demo | Vercel frontend + Render backend, publicly reachable |
| Public OSS repo | LICENSE in About; no secrets; no cached Qloo dumps |
| Complete product | Brief → compare → critic → decision → experiment; honest failure states |
| Non-obvious use | Unexpected partners **and** adversarial disproof, not “recommend similar brands” |
| Real audience | Independent / local brand owners, budget-constrained pop-ups |

## 8. Verification spot-checks

| Claim checked | Result | Official source |
| --- | --- | --- |
| Submission window and judging window | Confirmed against Rules §1; dates above reflect the rules text | [Official Rules](https://qloo.devpost.com/rules) |
| A qualifying project must integrate Qloo and be an agentic tool, use an agent framework, or integrate Qloo into an existing agent | Confirmed, Rules §4 | [Official Rules](https://qloo.devpost.com/rules) |
| Existing projects must be significantly updated during the submission period | Confirmed as stated in Rules §4; the source contains an apparent typo in the sentence, so this summary does not infer extra conditions | [Official Rules](https://qloo.devpost.com/rules) |
| Third-party SDKs, APIs, and data must be used under their terms/licenses | Confirmed, Rules §4 | [Official Rules](https://qloo.devpost.com/rules) |
| Functional demo and public source repository with source/assets/instructions and an open-source license are required | Confirmed, Rules §5 | [Official Rules](https://qloo.devpost.com/rules) |
| Rules §5 permits private websites if judge login credentials are supplied; the event listing separately disqualifies demos relying on private access | Both statements confirmed; use the stricter public listing requirement for the entry | [Official Rules](https://qloo.devpost.com/rules); [event listing](https://qloo.devpost.com/) |
| Stage One is pass/fail; Stage Two has four equally weighted criteria | Confirmed, Rules §6 | [Official Rules](https://qloo.devpost.com/rules) |
| The four Stage Two criteria are implementation, design, impact, and idea quality | Confirmed, Rules §6; descriptions above follow the rules wording | [Official Rules](https://qloo.devpost.com/rules) |
| The listed first, second, and third prizes are $15,000, $6,000, and $4,000 USD | Confirmed, Rules §8 | [Official Rules](https://qloo.devpost.com/rules) |

The official event listing independently emphasizes Qloo-powered cultural grounding and sets the externally hosted/public-access demo condition: [event listing](https://qloo.devpost.com/). Where this differs from Rules §5 on a private website with credentials, follow the listing's stricter condition for eligibility.
