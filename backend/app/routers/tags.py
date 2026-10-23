# backend/app/routers/tags.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.core.tag_colors import color_sort_key
from app.models.tag import Tag, calendar_entry_tags
from app.models.user import User
from app.schemas.tag import TagCreate, TagOut, TagUpdate

router = APIRouter()


def _ensure_unique(db: Session, name: str, ignore_id: int | None = None) -> None:
    query = db.query(Tag).filter(func.lower(Tag.name) == name.lower())
    if ignore_id is not None:
        query = query.filter(Tag.id != ignore_id)
    if query.first() is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Já existe uma etiqueta com esse nome")


@router.get("/tags", response_model=list[TagOut])
async def list_tags(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("calendar.view")),
):
    # Ordenado por matiz (roda de cores), não alfabético — cor combina chaves
    # de paleta e hex customizado, por isso é feito em Python e não em SQL.
    tags = db.query(Tag).all()
    tags.sort(key=lambda t: (color_sort_key(t.color), t.name.lower()))
    return tags


@router.post("/tags", response_model=TagOut, status_code=201)
async def create_tag(
    payload: TagCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("calendar.edit")),
):
    _ensure_unique(db, payload.name)
    tag = Tag(name=payload.name, color=payload.color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.patch("/tags/{tag_id}", response_model=TagOut)
async def update_tag(
    tag_id: int,
    payload: TagUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("calendar.edit")),
):
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Etiqueta não encontrada")

    data = payload.model_dump(exclude_unset=True)
    if data.get("name") is not None:
        _ensure_unique(db, data["name"], ignore_id=tag_id)
    for field, value in data.items():
        if value is not None:
            setattr(tag, field, value)

    db.commit()
    db.refresh(tag)
    return tag


@router.delete("/tags/{tag_id}", status_code=204)
async def delete_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("calendar.delete")),
):
    tag = db.get(Tag, tag_id)
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Etiqueta não encontrada")

    # Tira a etiqueta de todas as postagens antes (não depende do ON DELETE CASCADE do banco).
    db.execute(calendar_entry_tags.delete().where(calendar_entry_tags.c.tag_id == tag_id))
    db.delete(tag)
    db.commit()
