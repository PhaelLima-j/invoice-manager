from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import verify_password, create_access_token
from app.db.session import get_db
from app.schemas.client import ClientCreate, ClientOut, Token
from app.crud import client as client_crud

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=ClientOut)
def register(payload: ClientCreate, db: Session = Depends(get_db)):
    existing = client_crud.get_client_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    return client_crud.create_client(db, payload)


@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    client = client_crud.get_client_by_email(db, form.username)

    if not client or not verify_password(form.password, client.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    token = create_access_token({"sub": str(client.id)})
    return Token(access_token=token)