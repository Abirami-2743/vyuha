"""Name and locality matching tests for independent OSM verification."""

import asyncio

import httpx
import pytest

from backend.app.verification import NominatimClient, OSMPlace, normalize_brand_name


def place(name: str, *, address: dict[str, str] | None = None) -> OSMPlace:
    return OSMPlace(
        osm_type="node",
        osm_id=1,
        name=name,
        display_name=f"{name}, Mumbai, Maharashtra, India",
        lat="19.0760",
        lon="72.8777",
        address=address or {"city_district": "Mumbai", "country": "India"},
    )


@pytest.mark.parametrize(
    ("query", "returned"),
    [
        ("Domino's", "Domino’s"),
        ("McDonald's", "McDonalds"),
        ("Trader Joe's", "Trader Joes"),
        ("Levi's", "Levi’s"),
        ("Cafe Creme", "Café Crème"),
        ('The "A&B" Shop', "the a and b shop"),
        ("Domino's Pizza", "Domino's Pizza | Deonar, Mumbai"),
    ],
)
def test_exact_name_matching_normalizes_apostrophes_quotes_accents_and_suffixes(
    query: str,
    returned: str,
) -> None:
    assert NominatimClient.exact_name_matches(query, [place(returned)])


def test_normalization_does_not_collapse_different_business_names() -> None:
    assert normalize_brand_name("Starbucks Reserve Roastery") != normalize_brand_name(
        "Starbucks"
    )
    assert not NominatimClient.exact_name_matches("Trader Joe's", [place("Trader Joe's Tavern")])


def test_non_us_market_matches_city_district_locality() -> None:
    matches = NominatimClient.local_matches(
        "Mumbai, Maharashtra, India",
        [place("Domino's Pizza", address={"city_district": "Mumbai", "country": "India"})],
    )

    assert len(matches) == 1


def test_nominatim_search_sends_business_name_and_full_market() -> None:
    observed: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        observed.append(request.url.params["q"])
        return httpx.Response(200, json=[])

    async def exercise() -> None:
        async with NominatimClient(transport=httpx.MockTransport(handle)) as client:
            await client.search("Domino's Pizza", "Mumbai, Maharashtra, India")

    asyncio.run(exercise())

    assert observed == ["Domino's Pizza, Mumbai, Maharashtra, India"]
