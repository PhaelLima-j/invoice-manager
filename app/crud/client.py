from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.client import Client
from app.schemas.client import ClientCreate


def get_client_by_email(db: Session, email: str) -> Client | None:
    return db.execute(select(Client).where(Client.email == email)).scalar_one_or_none()


def create_client(db: Session, payload: ClientCreate) -> Client:
    client = Client(
        company_name=payload.company_name,
        cnpj=payload.cnpj,
        address=payload.address,
        zip_code=payload.zip_code,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    return client