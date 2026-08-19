# backend/app/routers/clients.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.models.client import Client
from app.models.user import User
from app.schemas.client import ClientCreate, ClientOut, ClientUpdate

router = APIRouter()


def _validate_user_refs(db: Session, *user_ids: int | None) -> None:
    for user_id in user_ids:
        if user_id is not None and db.get(User, user_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuário responsável inválido")


@router.get("/clients", response_model=list[ClientOut])
async def list_clients(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("client.view")),
):
    return db.query(Client).order_by(Client.name).all()


@router.post("/clients", response_model=ClientOut, status_code=201)
async def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("client.create")),
):
    _validate_user_refs(db, payload.default_social_id, payload.default_designer_id)

    client = Client(**payload.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return client


@router.patch("/clients/{client_id}", response_model=ClientOut)
async def update_client(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("client.edit")),
):
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")

    data = payload.model_dump(exclude_unset=True)
    _validate_user_refs(db, data.get("default_social_id"), data.get("default_designer_id"))

    for field, value in data.items():
        setattr(client, field, value)

    db.commit()
    db.refresh(client)
    return client


@router.delete("/clients/{client_id}", status_code=204)
async def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("client.delete")),
):
    client = db.get(Client, client_id)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")

    db.delete(client)
    try:
        db.commit()
    except IntegrityError:
        # Cliente com postagens no calendário (client_id NOT NULL lá) ou
        # demandas vinculadas não pode ser apagado — a FK barra no banco e
        # sem esse catch virava 500 cru. Orientação: desativar em vez de
        # apagar, sem perder o histórico de calendário/produção do cliente.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esse cliente tem postagens ou demandas vinculadas e não pode ser removido. "
            "Marque-o como inativo em vez de excluir, se quiser tirá-lo da lista.",
        )
