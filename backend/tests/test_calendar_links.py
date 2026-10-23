# backend/tests/test_calendar_links.py
"""Links de referência e material (pasta do Drive etc.) nas postagens."""
from datetime import date

import pytest

from app.services.links import normalize_link, normalize_links

DRIVE = "https://drive.google.com/drive/folders/abc123"


def _create(api, client_id, **extra):
    body = {"client_id": client_id, "scheduled_date": str(date(2099, 1, 10)), "theme": "Tema", **extra}
    return api.post("/api/v1/calendar-entries", json=body)


def test_normalize_link_adds_scheme_and_trims():
    assert normalize_link("  drive.google.com/x ") == "https://drive.google.com/x"
    assert normalize_link("http://exemplo.com") == "http://exemplo.com"


@pytest.mark.parametrize("bad", ["", "   ", "javascript:alert(1)", "ftp://x.com/a", "https://", "dois palavras.com"])
def test_normalize_link_rejects_invalid(bad):
    with pytest.raises(ValueError):
        normalize_link(bad)


def test_normalize_links_dedupes_keeping_order_and_limits():
    assert normalize_links(["a.com", "https://a.com", "b.com"]) == ["https://a.com", "https://b.com"]
    assert normalize_links(None) is None
    with pytest.raises(ValueError):
        normalize_links([f"site{i}.com" for i in range(21)])


def test_new_entry_has_empty_links(api, client_row):
    body = _create(api, client_row.id).json()
    assert body["reference_links"] == [] and body["material_links"] == []


def test_create_saves_normalized_links(api, client_row):
    res = _create(api, client_row.id, reference_links=["drive.google.com/ref"], material_links=[DRIVE, DRIVE])
    assert res.status_code == 201
    body = res.json()
    assert body["reference_links"] == ["https://drive.google.com/ref"]
    assert body["material_links"] == [DRIVE]


def test_patch_updates_and_clears_links(api, client_row):
    entry = _create(api, client_row.id, material_links=[DRIVE]).json()
    url = f"/api/v1/calendar-entries/{entry['id']}"
    assert api.patch(url, json={"material_links": []}).json()["material_links"] == []
    assert api.patch(url, json={"reference_links": [DRIVE]}).json()["reference_links"] == [DRIVE]


def test_rejects_unsafe_link(api, client_row):
    assert _create(api, client_row.id, material_links=["javascript:alert(1)"]).status_code == 422
