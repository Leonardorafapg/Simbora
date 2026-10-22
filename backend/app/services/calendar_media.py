# backend/app/services/calendar_media.py
"""Consistência entre as artes de uma postagem do calendário."""

MAX_CAROUSEL_SLIDES = 10


def normalize_post_media(post_type: str, final_image: str | None, final_images: list[str] | None):
    """Devolve (final_image, final_images) coerentes com o tipo do post.

    Carrossel: `final_images` é a fonte da verdade e a capa (`final_image`) é
    sempre o 1º slide; sem slides, a arte única vira o 1º slide. Feed: não
    guarda slides.
    """
    slides = list(final_images or [])
    if post_type == "carousel":
        if not slides and final_image:
            slides = [final_image]
        return (slides[0] if slides else None), slides
    return final_image, []
