# backend/app/routers/leads.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from typing import Optional, Literal

router = APIRouter()

class LeadCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    specialty: Optional[str] = None
    source: Literal["site", "medicos"]

@router.post("/leads", status_code=201)
async def create_lead(lead: LeadCreate):
    """
    Recebe leads dos formulários do site e LP de médicos.
    """
    print(f"[NOVO LEAD] {lead.name} | {lead.phone} | origem: {lead.source}")
    # TODO: Integrar com banco de dados
    return {"message": "Lead recebido com sucesso", "name": lead.name}
