# backend/tests/test_calendar_media.py
"""Artes da postagem do calendário: feed (1 arte) e carrossel (slides ordenados)."""
from datetime import date

from app.services.calendar_media import normalize_post_media

A, B, C = "https://media.test/a.png", "https://media.test/b.png", "https://media.test/c.png"


def _create(api, client_id, **extra):
    body = {"client_id": client_id, "scheduled_date": str(date(2099, 1, 10)), "theme": "Tema", **extra}
    return api.post("/api/v1/calendar-entries", json=body)


def test_normalize_carousel_uses_first_slide_as_cover():
    assert normalize_post_media("carousel", "outra", [A, B]) == (A, [A, B])


def test_normalize_carousel_promotes_single_art_to_first_slide():
    assert normalize_post_media("carousel", A, []) == (A, [A])
    assert normalize_post_media("carousel", None, None) == (None, [])


def test_normalize_feed_drops_slides():
    assert normalize_post_media("feed", A, [B, C]) == (A, [])


def test_new_entry_defaults_to_feed(api, client_row):
    body = _create(api, client_row.id).json()
    assert body["post_type"] == "feed" and body["final_images"] == []


def test_create_carousel_keeps_order_and_syncs_cover(api, client_row):
    res = _create(api, client_row.id, post_type="carousel", final_images=[B, A, C], final_image=A)
    assert res.status_code == 201
    body = res.json()
    assert body["final_images"] == [B, A, C]
    assert body["final_image"] == B


def test_patch_reorder_updates_cover(api, client_row):
    entry = _create(api, client_row.id, post_type="carousel", final_images=[A, B, C]).json()
    res = api.patch(f"/api/v1/calendar-entries/{entry['id']}", json={"final_images": [C, A, B]})
    assert res.status_code == 200
    assert res.json()["final_images"] == [C, A, B]
    assert res.json()["final_image"] == C


def test_patch_back_to_feed_clears_slides(api, client_row):
    entry = _create(api, client_row.id, post_type="carousel", final_images=[A, B]).json()
    res = api.patch(f"/api/v1/calendar-entries/{entry['id']}", json={"post_type": "feed"})
    assert res.json()["final_images"] == []
    assert res.json()["final_image"] == A


def test_rejects_more_than_ten_slides(api, client_row):
    slides = [f"https://media.test/{i}.png" for i in range(11)]
    assert _create(api, client_row.id, post_type="carousel", final_images=slides).status_code == 422


def test_rejects_unknown_post_type(api, client_row):
    assert _create(api, client_row.id, post_type="reels").status_code == 422
