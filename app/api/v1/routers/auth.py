from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.security import verify_password, create_access_token
from app.core.rate_limit import check_rate_limit
from app.db.session import get_db
from app.schemas.client import ClientCreate, ClientOut, Token
from app.crud import client as client_crud

router = APIRouter(prefix="/auth", tags=["auth"])

# Limites (ajustáveis): tentativas por janela de tempo, por IP.
LOGIN_MAX_ATTEMPTS = 5
LOGIN_WINDOW_SECONDS = 60
REGISTER_MAX_ATTEMPTS = 5
REGISTER_WINDOW_SECONDS = 300


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "desconhecido"


@router.post("/register", response_model=ClientOut)
def register(payload: ClientCreate, request: Request, db: Session = Depends(get_db)):
    if not check_rate_limit(
        f"register:{_client_ip(request)}",
        max_attempts=REGISTER_MAX_ATTEMPTS,
        window_seconds=REGISTER_WINDOW_SECONDS,
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de cadastro. Tente novamente em alguns minutos.",
        )

    existing = client_crud.get_client_by_email(db, payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
    try:
        return client_crud.create_client(db, payload)
    except client_crud.ClientAlreadyExists as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/login", response_model=Token)
def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    if not check_rate_limit(
        f"login:{_client_ip(request)}:{form.username}",
        max_attempts=LOGIN_MAX_ATTEMPTS,
        window_seconds=LOGIN_WINDOW_SECONDS,
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Muitas tentativas de login. Aguarde um momento e tente de novo.",
        )

    client = client_crud.get_client_by_email(db, form.username)

    if not client or not verify_password(form.password, client.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
        )

    token = create_access_token({"sub": str(client.id)})
    return Token(access_token=token)