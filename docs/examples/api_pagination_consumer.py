"""
YieldVault API Pagination Consumer Example (Python)

Demonstrates deterministic cursor-based paging against list endpoints such as:
- GET /api/transactions
- GET /api/portfolio/holdings
- GET /api/vault/history

Usage:
    API_BASE_URL=http://localhost:3000 python docs/examples/api_pagination_consumer.py
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

API_BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:3000")


def build_url(path: str, params: dict[str, Any] | None = None) -> str:
    query = urllib.parse.urlencode({k: v for k, v in (params or {}).items() if v not in (None, "")})
    return f"{API_BASE_URL.rstrip('/')}{path}" + (f"?{query}" if query else "")


def fetch_page(path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    request = urllib.request.Request(build_url(path, params or {}), method="GET")
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_all_with_cursor(path: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    cursor: str | None = None

    while True:
        page_params = dict(params or {})
        if cursor:
            page_params["cursor"] = cursor

        page = fetch_page(path, page_params)
        for item in page.get("data", []):
            item_id = item["id"]
            if item_id in seen_ids:
                raise RuntimeError(f"Duplicate item detected while paging: {item_id}")
            seen_ids.add(item_id)
            items.append(item)

        pagination = page.get("pagination", {})
        if not pagination.get("hasNextPage") or not pagination.get("nextCursor"):
            break

        cursor = pagination["nextCursor"]

    return items


def assert_deterministic_first_page(path: str, params: dict[str, Any] | None = None) -> None:
    first = fetch_page(path, params)
    second = fetch_page(path, params)

    first_ids = [item["id"] for item in first.get("data", [])]
    second_ids = [item["id"] for item in second.get("data", [])]

    if first_ids != second_ids:
        raise RuntimeError("First page ordering changed between identical requests")


def demonstrate_transaction_paging(limit: int = 5) -> None:
    print(f"\n=== Cursor paging demo (limit={limit}) ===")

    page1 = fetch_page("/api/transactions", {"limit": limit})
    page1_ids = [item["id"] for item in page1.get("data", [])]
    print("Page 1 IDs:", ", ".join(page1_ids))
    print("nextCursor:", page1.get("pagination", {}).get("nextCursor") or "(none)")

    next_cursor = page1.get("pagination", {}).get("nextCursor")
    if not next_cursor:
        print("No additional pages available.")
        return

    page2 = fetch_page("/api/transactions", {"limit": limit, "cursor": next_cursor})
    page2_ids = {item["id"] for item in page2.get("data", [])}
    overlap = [item_id for item_id in page1_ids if item_id in page2_ids]
    if overlap:
        raise RuntimeError(f"Pages overlapped: {', '.join(overlap)}")

    print("Page 2 IDs:", ", ".join(sorted(page2_ids)))
    print("No overlap between page 1 and page 2.")


def main() -> None:
    print(f"Using API base URL: {API_BASE_URL}")

    assert_deterministic_first_page("/api/transactions", {"limit": 5})
    print("Deterministic first-page check passed.")

    demonstrate_transaction_paging(5)

    items = fetch_all_with_cursor("/api/transactions", {"limit": 20})
    print(f"Fetched {len(items)} transactions across all pages.")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.URLError as error:
        raise SystemExit(f"Request failed: {error}") from error
